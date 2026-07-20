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
  type ChangelogMode,
  type ConstructNode,
  computeChangelogModes,
  type ResolvedColumn,
  resolveNodeSchema,
  resolveSiblingChains,
  resolveTransformSchema,
  SynthContext,
  type ValidationDiagnostic,
  validateChangelogModes,
} from "@flink-reactor/dsl/browser"
import type {
  DecodedChangelogMode,
  DecodedEdge,
  DecodedNodeSchema,
  DecodedSinkAccept,
  DecodedTableField,
  DecodedTableSchema,
} from "./types.js"

/** The minimal shape of a `SchemaDefinition` this module reads off a node's
 *  `schema` prop (its full type is not exported through the worker boundary). */
interface SchemaDefinitionLike {
  readonly primaryKey?: { readonly columns?: readonly string[] }
  readonly watermark?: { readonly column: string; readonly expression: string }
}

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

// ── Graph facts for hover ────────────────────────────────────────────

/**
 * Sinks that natively accept retract/upsert streams. Mirrors the DSL's private
 * `CHANGELOG_CAPABLE_SINKS`: the DSL does not export it, and `sinkAcceptsChangelog`
 * needs the live node + props (which never reach the host), so sink acceptance
 * is resolved here in the worker and serialized.
 */
const CHANGELOG_CAPABLE_SINKS: ReadonlySet<string> = new Set([
  "JdbcSink", // only with upsertMode === true
  "PaimonSink",
  "IcebergSink",
])

/** The changelog modes a sink accepts, for the hover sink card. */
function sinkAcceptedModes(node: ConstructNode): ChangelogMode[] {
  const accepts =
    node.component === "JdbcSink"
      ? node.props.upsertMode === true
      : CHANGELOG_CAPABLE_SINKS.has(node.component)
  return accepts ? ["append-only", "retract", "upsert"] : ["append-only"]
}

export interface GraphFacts {
  readonly edges: readonly DecodedEdge[]
  readonly dagEdges: readonly DecodedEdge[]
  readonly changelogModes: readonly DecodedChangelogMode[]
  readonly sinkChangelogAccepts: readonly DecodedSinkAccept[]
  readonly nodeInputSchemas: readonly DecodedNodeSchema[]
  readonly tableSchemas: readonly DecodedTableSchema[]
}

// ── Visualization DAG edges (DAG-VIS) ────────────────────────────────

/**
 * Build the **full** visualization DAG edges from the construct tree. Unlike
 * the chain-aware `buildDataflowContext` (which scopes to a single container's
 * linear sibling chain and so mis-wires nested Route branches and parallel Join
 * inputs), this threads the upstream *across* nesting:
 *
 *  - **Sibling chains** — within a container, consecutive dataflow nodes chain
 *    `Source → Transform → … → Sink`; a Sink does not consume the upstream, so
 *    several sinks fan out from one chain head.
 *  - **Route / SideOutput fan-out** — the upstream feeds the routing node, then
 *    each branch wrapper (`Route.Branch`/`Route.Default`) continues the chain
 *    *seeded from the routing node*, so a sink nested in a branch is reached.
 *  - **Join / multi-input fan-in** — each input held in a `left`/`right`/
 *    `stream`/`temporal`/`input` prop (or attached as a child) is an edge into
 *    the join; the join then becomes the chain head.
 *
 * Pure and non-throwing; the graph-model request projects these edges directly.
 */
export function collectDagEdges(root: ConstructNode): DecodedEdge[] {
  const edges: DecodedEdge[] = []
  const seen = new Set<string>()
  const addEdge = (from: string, to: string): void => {
    if (from === to) return
    const key = `${from} ${to}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ from, to })
  }

  const ROUTING = new Set(["Route", "SideOutput"])

  /** Wire a sibling list as a dataflow chain, seeded with an optional upstream
   *  (used when a Route branch continues from the routing node). */
  const wireChain = (
    siblings: readonly ConstructNode[],
    seedUpstream: string | undefined,
  ): void => {
    let upstream = seedUpstream
    for (const child of siblings) {
      if (ROUTING.has(child.component)) {
        if (upstream) addEdge(upstream, child.id)
        for (const branch of child.children) {
          addEdge(child.id, branch.id)
          wireChain(branch.children, branch.id)
        }
        upstream = child.id
        continue
      }
      if (child.kind === "Join") {
        const inputs = propInputIds(child)
        const inputSet = new Set(inputs)
        for (const inId of inputs) addEdge(inId, child.id)
        if (upstream && !inputSet.has(upstream)) addEdge(upstream, child.id)
        // An input node attached as a child is already wired; descend only into
        // its own subtree. A non-input child continues the chain from the join.
        for (const c of child.children) {
          if (inputSet.has(c.id)) wireChain(c.children, c.id)
          else wireChain([c], child.id)
        }
        upstream = child.id
        continue
      }
      switch (child.kind) {
        case "Source":
        case "RawSQL":
          upstream = child.id
          wireChain(child.children, child.id)
          break
        case "Transform":
        case "Window":
        case "CEP":
          if (upstream) addEdge(upstream, child.id)
          upstream = child.id
          wireChain(child.children, child.id)
          break
        case "Sink":
          if (upstream) addEdge(upstream, child.id)
          // Terminal: keep `upstream` so later siblings fan out from the same
          // head. Explicit-nesting children (`Sink({children:[src]})`) form
          // their own chain.
          wireChain(child.children, undefined)
          break
        default:
          // Containers (StatementSet) and config sub-nodes: descend, carrying
          // the upstream through so a chain spanning a container is preserved.
          wireChain(child.children, upstream)
      }
    }
  }

  wireChain(root.children, undefined)
  return edges
}

/**
 * Resolve, for every node, the schema *feeding* its expression props — the
 * columns visible to a `Filter` condition, a `Map` projection, a join `on`, a
 * `Query.Select`, etc. Folds the DSL's `resolveTransformSchema` along the
 * dataflow graph so renames/aggregations/windows are reflected; a node with no
 * dataflow edge of its own (a config sub-node like `Query.Select`, or the
 * `Aggregate` nested inside a window) inherits its construct-tree parent's
 * input. Non-throwing: any resolution failure yields no schema for that node
 * rather than failing synthesis.
 */
function collectNodeInputSchemas(
  ctx: SynthContext,
  root: ConstructNode,
): DecodedNodeSchema[] {
  // Index every node reachable through children *and* through join-style input
  // props (`Join` `left`/`right`, `TemporalJoin` `stream`/`temporal`,
  // `LookupJoin` `input`) — those inputs are not construct-tree children and so
  // are absent from the chain-aware dataflow edges, but a join's `on` references
  // both sides' columns.
  const nodeIndex = new Map<string, ConstructNode>()
  const parentOf = new Map<string, ConstructNode>()
  const index = (node: ConstructNode, parent?: ConstructNode): void => {
    if (nodeIndex.has(node.id)) return
    nodeIndex.set(node.id, node)
    if (parent) parentOf.set(node.id, parent)
    for (const child of node.children) index(child, node)
  }
  index(root)

  const inCache = new Map<string, readonly ResolvedColumn[]>()
  const outCache = new Map<string, readonly ResolvedColumn[]>()

  /** Upstream node ids: chain-aware dataflow edges plus join-style prop inputs. */
  const inputIdsOf = (id: string): string[] => {
    const node = nodeIndex.get(id)
    const fromProps = node ? propInputIds(node) : []
    return [...new Set([...ctx.getIncoming(id), ...fromProps])]
  }

  const inputOf = (
    id: string,
    guard: Set<string>,
  ): readonly ResolvedColumn[] => {
    const cached = inCache.get(id)
    if (cached) return cached
    if (guard.has(id)) return []
    guard.add(id)
    const inputs = inputIdsOf(id)
    let result: readonly ResolvedColumn[]
    if (inputs.length > 0) {
      result = dedupeByName(inputs.flatMap((from) => outputOf(from, guard)))
    } else {
      // No upstream — inherit the construct-tree parent's input (a config
      // sub-node like `Query.Select`, or an `Aggregate` nested in a window).
      const parent = parentOf.get(id)
      result = parent ? inputOf(parent.id, guard) : []
    }
    inCache.set(id, result)
    return result
  }

  const outputOf = (
    id: string,
    guard: Set<string>,
  ): readonly ResolvedColumn[] => {
    const cached = outCache.get(id)
    if (cached) return cached
    const node = ctx.getNode(id) ?? nodeIndex.get(id)
    if (!node) return []
    let result: readonly ResolvedColumn[]
    if (node.kind === "Source") {
      result = resolveNodeSchema(node, nodeIndex) ?? []
    } else {
      const input = inputOf(id, guard)
      result = resolveTransformSchema(node, [...input]) ?? input
    }
    outCache.set(id, result)
    return result
  }

  const schemas: DecodedNodeSchema[] = []
  for (const node of nodeIndex.values()) {
    // Sources/containers have no expression props feeding off an input schema;
    // skip them (a join's source children would otherwise inherit the merged
    // schema via the parent fallback).
    if (node.kind === "Source" || node.kind === "Pipeline") continue
    const cols = inputOf(node.id, new Set())
    if (cols.length > 0) {
      schemas.push({
        nodeId: node.id,
        columns: cols.map((c) => ({ name: c.name, type: c.type })),
      })
    }
  }
  return schemas
}

/** Props through which join-style components hold their input nodes — `Join`/
 *  `IntervalJoin` `left`/`right`, `TemporalJoin` `stream`/`temporal`,
 *  `LookupJoin` `input`. The DSL stores these as the input node's *id* (and also
 *  attaches it as a child for DAG edges), so they are absent from the chain-
 *  aware dataflow edges; a join's `on` must still see both sides' columns. */
const INPUT_PROPS: readonly string[] = [
  "left",
  "right",
  "input",
  "stream",
  "temporal",
]

function isConstructNode(value: unknown): value is ConstructNode {
  if (typeof value !== "object" || value === null) return false
  const o = value as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.component === "string" &&
    typeof o.kind === "string" &&
    Array.isArray(o.children)
  )
}

/** The ids of input nodes a join-style node holds in its props (stored as an
 *  id string, or — defensively — as a ConstructNode). */
function propInputIds(node: ConstructNode): string[] {
  const out: string[] = []
  for (const prop of INPUT_PROPS) {
    const value = node.props[prop]
    if (typeof value === "string") out.push(value)
    else if (isConstructNode(value)) out.push(value.id)
  }
  return out
}

function dedupeByName(cols: readonly ResolvedColumn[]): ResolvedColumn[] {
  const seen = new Set<string>()
  const out: ResolvedColumn[] = []
  for (const c of cols)
    if (!seen.has(c.name)) {
      seen.add(c.name)
      out.push(c)
    }
  return out
}

/**
 * Project every source and sink to the table schema the `schemaTree` request
 * renders. A source's fields/PK/watermark come from its declared
 * `SchemaDefinition` (`resolveNodeSchema` for the field types, `props.schema`
 * for PK membership and the watermark); a sink writes whatever flows into it, so
 * its fields are the inferred *input* schema (`nodeInputSchemas`, computed just
 * above). Non-throwing: a resolution failure for one node is skipped rather than
 * failing synthesis.
 */
function collectTableSchemas(
  root: ConstructNode,
  nodeInputSchemas: readonly DecodedNodeSchema[],
): DecodedTableSchema[] {
  const nodeIndex = new Map<string, ConstructNode>()
  const index = (node: ConstructNode): void => {
    if (nodeIndex.has(node.id)) return
    nodeIndex.set(node.id, node)
    for (const child of node.children) index(child)
  }
  index(root)
  const inputByNode = new Map(
    nodeInputSchemas.map((s) => [s.nodeId, s.columns]),
  )

  const tables: DecodedTableSchema[] = []
  for (const node of nodeIndex.values()) {
    const role =
      node.kind === "Source"
        ? "source"
        : node.kind === "Sink"
          ? "sink"
          : undefined
    if (!role) continue

    const schemaDef = node.props.schema as SchemaDefinitionLike | undefined
    const pkColumns = new Set(schemaDef?.primaryKey?.columns ?? [])

    const columns =
      role === "source"
        ? (resolveNodeSchema(node, nodeIndex) ?? []).map((c) => ({
            name: c.name,
            type: c.type,
          }))
        : (inputByNode.get(node.id) ?? [])

    const fields: DecodedTableField[] = columns.map((c) => ({
      name: c.name,
      type: c.type,
      primaryKey: pkColumns.has(c.name),
    }))

    const name = node.props.name
    tables.push({
      nodeId: node.id,
      role,
      component: node.component,
      label: typeof name === "string" && name.length > 0 ? name : node.id,
      fields,
      // Only sources carry a watermark declaration; a sink writes a stream.
      watermark: role === "source" ? schemaDef?.watermark : undefined,
    })
  }
  return tables
}

/**
 * Derive the hover-facing graph facts that cannot cross the worker→host
 * serialization boundary as live objects: the dataflow edges (flattened from
 * the chain-aware `SynthContext`), each node's resolved output changelog mode,
 * and each sink's accepted changelog modes. Computed here in the worker, where
 * the `ConstructNode` tree and `SynthContext` still exist; the host reads the
 * decoded arrays.
 *
 * Reuses the same `buildDataflowContext` topology the changelog *diagnostics*
 * use, so hover neighbors and changelog badges agree with the squiggles.
 * Non-throwing: a degenerate graph (e.g. a cycle that trips the topological
 * sort) yields empty changelog facts rather than failing the whole synthesis.
 */
export function collectGraphFacts(root: ConstructNode): GraphFacts {
  const ctx = buildDataflowContext(root)

  const edges: DecodedEdge[] = ctx
    .getAllEdges()
    .map((e) => ({ from: e.from, to: e.to }))

  let dagEdges: DecodedEdge[] = []
  try {
    dagEdges = collectDagEdges(root)
  } catch {
    // A degenerate tree should not fail synthesis; the graph view degrades to
    // the chain-aware edges (or none) rather than blanking.
    dagEdges = edges
  }

  let changelogModes: DecodedChangelogMode[] = []
  try {
    changelogModes = [...computeChangelogModes(ctx)].map(([nodeId, mode]) => ({
      nodeId,
      mode,
    }))
  } catch {
    // Cycle or unexpected topology — skip changelog facts; hover degrades to
    // "no changelog mode" rather than the whole synthesis failing.
  }

  const sinkChangelogAccepts: DecodedSinkAccept[] = ctx
    .getAllNodes()
    .filter((n) => n.kind === "Sink")
    .map((n) => ({ nodeId: n.id, accepts: sinkAcceptedModes(n) }))

  let nodeInputSchemas: DecodedNodeSchema[] = []
  try {
    nodeInputSchemas = collectNodeInputSchemas(ctx, root)
  } catch {
    // Schema inference hiccup — column completion degrades to no items rather
    // than failing the whole synthesis.
  }

  let tableSchemas: DecodedTableSchema[] = []
  try {
    tableSchemas = collectTableSchemas(root, nodeInputSchemas)
  } catch {
    // Schema projection hiccup — the schema tree degrades to no tables rather
    // than failing the whole synthesis.
  }

  return {
    edges,
    dagEdges,
    changelogModes,
    sinkChangelogAccepts,
    nodeInputSchemas,
    tableSchemas,
  }
}
