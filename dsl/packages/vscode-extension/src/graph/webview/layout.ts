// Layered left-to-right DAG layout — pure, DOM-free, so it is unit-testable in
// plain Node. Sources fall on the left, sinks on the right; layers come from
// the server's `layer` hint when present, else a longest-path ranking over the
// edges. A light barycenter sweep orders nodes within a layer to reduce edge
// crossings. Deterministic: the same graph yields the same positions, which is
// what keeps unchanged nodes stable across refreshes.

import type { GraphModelEdge, GraphModelNode } from "../protocol.js"

export const NODE_W = 168
export const NODE_H = 46
const H_GAP = 64
const V_GAP = 26
const MARGIN = 28

export interface PlacedNode {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly layer: number
}

export interface Layout {
  readonly nodes: ReadonlyMap<string, PlacedNode>
  readonly width: number
  readonly height: number
}

/** Assign every node a layer: the server hint if all nodes carry one, else a
 *  longest-path rank (roots = 0, each node one past its deepest predecessor). */
function assignLayers(
  nodes: readonly GraphModelNode[],
  edges: readonly GraphModelEdge[],
): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id))
  if (nodes.length > 0 && nodes.every((n) => typeof n.layer === "number")) {
    return new Map(nodes.map((n) => [n.id, n.layer as number]))
  }
  const preds = new Map<string, string[]>()
  for (const id of ids) preds.set(id, [])
  for (const e of edges)
    if (ids.has(e.from) && ids.has(e.to)) preds.get(e.to)?.push(e.from)

  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const rank = (id: string): number => {
    const cached = layer.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    visiting.add(id)
    const ps = preds.get(id) ?? []
    const r = ps.length === 0 ? 0 : Math.max(...ps.map(rank)) + 1
    visiting.delete(id)
    layer.set(id, r)
    return r
  }
  for (const id of ids) rank(id)
  return layer
}

/**
 * Compute placements for a graph model. Within-layer ordering runs one
 * barycenter pass: a node sinks toward the average row of its predecessors in
 * the layer to its left, breaking ties by id for stability.
 */
export function computeLayout(
  nodes: readonly GraphModelNode[],
  edges: readonly GraphModelEdge[],
): Layout {
  const layerOf = assignLayers(nodes, edges)
  const ids = new Set(nodes.map((n) => n.id))

  // Bucket nodes by layer, seeded in a deterministic (id-sorted) order.
  const byLayer = new Map<number, string[]>()
  for (const n of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const l = layerOf.get(n.id) ?? 0
    const arr = byLayer.get(l)
    if (arr) arr.push(n.id)
    else byLayer.set(l, [n.id])
  }

  const preds = new Map<string, string[]>()
  for (const id of ids) preds.set(id, [])
  for (const e of edges)
    if (ids.has(e.from) && ids.has(e.to)) preds.get(e.to)?.push(e.from)

  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  const rowOf = new Map<string, number>()
  for (const l of layers) {
    const row = byLayer.get(l) ?? []
    if (l === layers[0]) {
      for (const [i, id] of row.entries()) rowOf.set(id, i)
      continue
    }
    const scored = row.map((id) => {
      const ps = (preds.get(id) ?? []).filter((p) => rowOf.has(p))
      const bary =
        ps.length > 0
          ? ps.reduce((s, p) => s + (rowOf.get(p) ?? 0), 0) / ps.length
          : Number.MAX_SAFE_INTEGER // no upstream → park at the bottom, stably
      return { id, bary }
    })
    scored.sort((a, b) => a.bary - b.bary || a.id.localeCompare(b.id))
    for (const [i, s] of scored.entries()) rowOf.set(s.id, i)
    byLayer.set(
      l,
      scored.map((s) => s.id),
    )
  }

  const placed = new Map<string, PlacedNode>()
  let maxRow = 0
  for (const l of layers) {
    const row = byLayer.get(l) ?? []
    for (const [i, id] of row.entries()) {
      placed.set(id, {
        id,
        layer: l,
        x: MARGIN + l * (NODE_W + H_GAP),
        y: MARGIN + i * (NODE_H + V_GAP),
        w: NODE_W,
        h: NODE_H,
      })
      maxRow = Math.max(maxRow, i)
    }
  }

  const width =
    MARGIN * 2 +
    (layers.length === 0 ? 0 : layers.length * (NODE_W + H_GAP) - H_GAP)
  const height = MARGIN * 2 + (maxRow + 1) * (NODE_H + V_GAP) - V_GAP
  return {
    nodes: placed,
    width: Math.max(width, 0),
    height: Math.max(height, 0),
  }
}
