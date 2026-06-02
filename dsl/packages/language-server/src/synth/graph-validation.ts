// Structural (`FR-DAG`) and changelog (`FR-CDC`) finding collection for the
// language server.
//
// The Tier-0 runner deliberately skipped these: `SynthContext.buildFromTree`
// builds parent→child edges, on which the DSL's structural detectors flag
// EVERY source as an orphan and changelog propagation runs backwards. This
// module supplies the chain-aware detection the spec's `validation-diagnostics`
// capability requires, reusing the DSL's own `resolveSiblingChains` (so
// "connected" means exactly what codegen's sibling-chain stitching means) and
// `validateChangelogModes` (run over a correctly-oriented dataflow graph).
//
// Findings are enriched at this layer — `category` is stamped, and changelog
// findings get `details.sourceNodeId`/`sinkNodeId` — so the diagnostic mapper
// stays a pure projection. No DSL validator behavior is modified.

import {
  type ConstructNode,
  resolveSiblingChains,
  SynthContext,
  type ValidationDiagnostic,
  validateChangelogModes,
} from "@flink-reactor/dsl/browser"

// ── Structural (FR-DAG) ──────────────────────────────────────────────

/**
 * Chain-aware structural findings: orphan sources, dangling sinks, and cycles.
 * Mirrors the CLI's `validateTreeAware`, stamping `category: "structure"` so
 * the mapper codes them `FR-DAG`.
 */
export function collectStructuralDiagnostics(
  root: ConstructNode,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = []

  const ctx = new SynthContext()
  ctx.buildFromTree(root)
  const { sinkToSource, sourceToSinks } = resolveSiblingChains(root)
  const nameIndex = buildSourceNameIndex(root)
  const referencedByName = collectNameReferences(root, nameIndex)

  // Orphan sources: a Source declared directly under <Pipeline>/<StatementSet>
  // that no sibling-chain sink consumes, no operator parent embeds, and no
  // other node references by name.
  const visitForOrphans = (node: ConstructNode): void => {
    if (node.component === "Pipeline" || node.component === "StatementSet") {
      for (const child of node.children) {
        if (child.kind !== "Source") continue
        if (sourceToSinks.has(child.id)) continue
        if (hasOperatorParent(ctx, child.id)) continue
        if (referencedByName.has(child.id)) continue
        diagnostics.push({
          severity: "error",
          message: `Orphan source '${child.component}' (${child.id}): declared but never consumed`,
          nodeId: child.id,
          component: child.component,
          category: "structure",
        })
      }
    }
    for (const child of node.children) visitForOrphans(child)
  }
  visitForOrphans(root)

  // Dangling sinks: a Sink with no explicit children, no incoming graph edge,
  // and no sibling-chain source feeding it.
  for (const sink of ctx.getNodesByKind("Sink")) {
    if (sink.children.length > 0) continue
    if (ctx.getOutgoing(sink.id).size > 0) continue
    if (sinkToSource.has(sink.id)) continue
    diagnostics.push({
      severity: "error",
      message: `Dangling sink '${sink.component}' (${sink.id}): no input path`,
      nodeId: sink.id,
      component: sink.component,
      category: "structure",
    })
  }

  // Cycles. A construct tree is acyclic, so this only fires for programmatic
  // graphs; stamp the category and surface participants as related nodes.
  for (const cycle of ctx.detectCycles()) {
    diagnostics.push({ ...cycle, category: "structure" })
  }

  return diagnostics
}

/** True when `sourceId` is a graph child of some non-container node (a Join/
 *  operator embedded the source as an input) — that counts as consumption. */
function hasOperatorParent(ctx: SynthContext, sourceId: string): boolean {
  for (const parentId of ctx.getIncoming(sourceId)) {
    const parent = ctx.getNode(parentId)
    if (!parent) continue
    if (parent.component === "Pipeline") continue
    if (parent.component === "StatementSet") continue
    return true
  }
  return false
}

/** SQL identifier → source node id, covering the source's own id plus literal
 *  `name`/`table` props (for name-based references like a LookupJoin `table`). */
function buildSourceNameIndex(root: ConstructNode): Map<string, string> {
  const map = new Map<string, string>()
  const walk = (node: ConstructNode): void => {
    if (node.kind === "Source") {
      map.set(node.id, node.id)
      const nameProp = node.props.name
      if (typeof nameProp === "string") map.set(nameProp, node.id)
      const tableProp = node.props.table
      if (typeof tableProp === "string") map.set(tableProp, node.id)
    }
    for (const child of node.children) walk(child)
  }
  walk(root)
  return map
}

/** Every source id referenced by a non-source node's prop string values. */
function collectNameReferences(
  root: ConstructNode,
  nameIndex: ReadonlyMap<string, string>,
): Set<string> {
  const refs = new Set<string>()
  const consider = (value: unknown): void => {
    if (typeof value !== "string") return
    const sourceId = nameIndex.get(value)
    if (sourceId) refs.add(sourceId)
  }
  const walk = (node: ConstructNode): void => {
    if (node.kind !== "Source") {
      for (const value of Object.values(node.props)) {
        if (Array.isArray(value)) value.forEach(consider)
        else consider(value)
      }
    }
    for (const child of node.children) walk(child)
  }
  walk(root)
  return refs
}

// ── Changelog (FR-CDC) ───────────────────────────────────────────────

/**
 * Changelog-mode findings over a correctly-oriented dataflow graph. Builds a
 * source→…→sink `SynthContext` from the sibling-chain topology, runs the DSL's
 * `validateChangelogModes`, and enriches each finding with the source/sink
 * endpoints so the mapper can render a cross-node `relatedInformation` link.
 *
 * Scope: linear sibling chains (the dominant authoring form, and the form the
 * SQL generator stitches). Explicit-nesting and multi-input (join/union)
 * changelog propagation is left to a later tier.
 */
export function collectChangelogDiagnostics(
  root: ConstructNode,
): ValidationDiagnostic[] {
  const ctx = buildDataflowContext(root)
  const findings = validateChangelogModes(ctx)

  return findings.map((finding) => {
    if (!finding.nodeId) return finding
    const sourceNodeId = findUpstreamSource(ctx, finding.nodeId)
    if (!sourceNodeId) return finding
    return {
      ...finding,
      details: {
        ...finding.details,
        sourceNodeId,
        sinkNodeId: finding.nodeId,
      },
    }
  })
}

/**
 * Build a dataflow `SynthContext` (source→…→sink edges) from the sibling-chain
 * topology. Within each container, children are walked left-to-right: a Source
 * starts/continues the chain, transforms/windows/joins extend it, and a Sink
 * terminates a branch while leaving the upstream available for fan-out to
 * further sinks.
 */
function buildDataflowContext(root: ConstructNode): SynthContext {
  const ctx = new SynthContext()
  const register = (node: ConstructNode): void => {
    ctx.addNode(node)
    for (const child of node.children) register(child)
  }
  register(root)

  const wire = (node: ConstructNode): void => {
    let upstream: string | undefined
    for (const child of node.children) {
      switch (child.kind) {
        case "Source":
        case "RawSQL":
          upstream = child.id
          break
        case "Transform":
        case "Window":
        case "Join":
        case "CEP":
          if (upstream) ctx.addEdge(upstream, child.id)
          upstream = child.id
          break
        case "Sink":
          if (upstream) ctx.addEdge(upstream, child.id)
          // Sink is terminal; keep `upstream` for fan-out to later sinks.
          break
      }
      wire(child)
    }
  }
  wire(root)

  return ctx
}

/** Walk upstream from a node to the nearest Source, following incoming edges. */
function findUpstreamSource(
  ctx: SynthContext,
  nodeId: string,
): string | undefined {
  const seen = new Set<string>()
  let frontier = [...ctx.getIncoming(nodeId)]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      const node = ctx.getNode(id)
      if (node?.kind === "Source") return id
      next.push(...ctx.getIncoming(id))
    }
    frontier = next
  }
  return undefined
}
