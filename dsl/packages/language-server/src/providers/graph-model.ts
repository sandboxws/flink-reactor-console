// `flinkReactor/graphModel` assembler.
//
// A pure, host-side re-projection of one document version's decoded
// `SynthesisResult` into the plain-JSON `GraphModelResponse` the webview
// renders. It joins the flat decoded arrays (nodes, dagEdges, statementOrigins,
// statementMeta, changelogModes, diagnostics) by `ConstructNode.id` — the one
// identity shared across topology, SQL, diagnostics, and the source-position
// map. No synthesis, no DSL objects: every field is JSON-serializable.

import type {
  GraphModelDiagnostic,
  GraphModelEdge,
  GraphModelNode,
  GraphModelResponse,
} from "../graph/model.js"
import type { SynthesisResult } from "../synth/types.js"

/** `StatementMeta` as it arrives decoded (`meta: unknown`). */
interface StatementMetaView {
  readonly component?: string
  readonly schema?: ReadonlyArray<{ name: string; type: string }>
}

/** The container kind that wraps the pipeline — excluded from the graph so the
 *  visualization shows only dataflow nodes (a linear `Source → Filter → Sink`
 *  is 3 nodes, not 4). */
const CONTAINER_KIND = "Pipeline"

/**
 * Build the graph model for a synthesized document. Never throws: a failed
 * synthesis (`result.ok === false`) becomes an `ok: false` envelope carrying
 * the load-error message, with the last good graph left to the webview.
 */
export function buildGraphModel(
  uri: string,
  version: number,
  result: SynthesisResult,
): GraphModelResponse {
  if (!result.ok) {
    return {
      uri,
      version,
      ok: false,
      error: result.loadError?.message ?? "synthesis failed",
      nodes: [],
      edges: [],
      statements: [],
    }
  }

  // ── Indexes (all keyed by node id) ──────────────────────────────────
  const metaByStmt = new Map<number, StatementMetaView>()
  for (const m of result.statementMeta)
    metaByStmt.set(m.statementIndex, (m.meta ?? {}) as StatementMetaView)

  const ownedStmts = new Map<string, number[]>()
  const schemaByNode = new Map<
    string,
    readonly { name: string; type: string }[]
  >()
  for (const o of result.statementOrigins) {
    push(ownedStmts, o.nodeId, o.statementIndex)
    if (!schemaByNode.has(o.nodeId)) {
      const schema = resolveSchema(metaByStmt, o.statementIndex, o.component)
      if (schema) schemaByNode.set(o.nodeId, schema)
    }
  }

  const changelogByNode = new Map<string, string>()
  for (const c of result.changelogModes) changelogByNode.set(c.nodeId, c.mode)

  const diagnosticsByNode = new Map<string, GraphModelDiagnostic[]>()
  for (const d of result.diagnostics) {
    if (!d.nodeId) continue
    push(diagnosticsByNode, d.nodeId, {
      severity: d.severity,
      category: d.category,
      message: d.message,
    })
  }

  // ── Visible nodes (drop the pipeline container) ─────────────────────
  const visible = result.nodes.filter((n) => n.kind !== CONTAINER_KIND)
  const visibleIds = new Set(visible.map((n) => n.id))

  // ── Edges (only between visible nodes), with changelog + crossNode ──
  const crossNodeKeys = new Set<string>()
  for (const d of result.diagnostics) {
    const src = d.details?.sourceNodeId
    const sink = d.details?.sinkNodeId
    if (d.category === "changelog" && src && sink)
      crossNodeKeys.add(`${src} ${sink}`)
  }
  const edges: GraphModelEdge[] = []
  for (const e of result.dagEdges) {
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) continue
    const edge: GraphModelEdge = { from: e.from, to: e.to }
    const upstreamMode = changelogByNode.get(e.from)
    const crossNode = crossNodeKeys.has(`${e.from} ${e.to}`)
    edges.push({
      ...edge,
      ...(upstreamMode ? { changelogMode: upstreamMode } : {}),
      ...(crossNode ? { crossNode: true } : {}),
    })
  }

  // ── Layer hint: longest-path rank over the visible DAG ──────────────
  const layerOf = computeLayers(visibleIds, edges)

  // ── Project nodes ───────────────────────────────────────────────────
  const nodes: GraphModelNode[] = visible.map((n) => {
    const schema = schemaByNode.get(n.id)
    const changelogMode = changelogByNode.get(n.id)
    const layer = layerOf.get(n.id)
    const node: GraphModelNode = {
      id: n.id,
      kind: n.kind,
      component: n.component,
      label: n.name ?? n.id,
      statementIndices: ownedStmts.get(n.id) ?? [],
      diagnostics: diagnosticsByNode.get(n.id) ?? [],
      ...(schema ? { schema } : {}),
      ...(changelogMode ? { changelogMode } : {}),
      ...(layer !== undefined ? { layer } : {}),
    }
    return node
  })

  return {
    uri,
    version,
    ok: true,
    nodes,
    edges,
    statements: result.statements,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

/**
 * The schema-bearing `StatementMeta` is attached to the comment banner that
 * immediately precedes a statement (index − 1) and carries no `nodeId`, so it
 * is paired to the origin node by adjacency + component, falling back to the
 * statement's own index. Mirrors the hover provider's `resolveSchema` so the
 * graph card and the hover card agree.
 */
function resolveSchema(
  metaByStmt: ReadonlyMap<number, StatementMetaView>,
  originIndex: number,
  component: string,
): readonly { name: string; type: string }[] | undefined {
  for (const idx of [originIndex - 1, originIndex]) {
    const meta = metaByStmt.get(idx)
    if (
      meta?.schema &&
      meta.schema.length > 0 &&
      (meta.component === undefined || meta.component === component)
    ) {
      return meta.schema.map((c) => ({ name: c.name, type: c.type }))
    }
  }
  return undefined
}

/**
 * Longest-path layer assignment over the DAG: a node's layer is one past the
 * deepest of its predecessors (roots = 0). Stable for acyclic graphs; a stray
 * cycle is bounded by the node count so it terminates rather than spinning.
 */
function computeLayers(
  nodeIds: ReadonlySet<string>,
  edges: readonly GraphModelEdge[],
): Map<string, number> {
  const preds = new Map<string, string[]>()
  for (const id of nodeIds) preds.set(id, [])
  for (const e of edges) preds.get(e.to)?.push(e.from)

  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const rank = (id: string): number => {
    const cached = layer.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0 // cycle guard
    visiting.add(id)
    const ps = preds.get(id) ?? []
    const r = ps.length === 0 ? 0 : Math.max(...ps.map(rank)) + 1
    visiting.delete(id)
    layer.set(id, r)
    return r
  }
  for (const id of nodeIds) rank(id)
  return layer
}
