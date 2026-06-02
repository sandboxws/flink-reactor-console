import { describe, expect, it } from "vitest"
import type { GraphModelEdge, GraphModelNode } from "../../src/graph/protocol"
import { computeLayout } from "../../src/graph/webview/layout"

function node(id: string, layer?: number): GraphModelNode {
  return {
    id,
    kind: "Transform",
    component: "X",
    label: id,
    statementIndices: [],
    diagnostics: [],
    ...(layer !== undefined ? { layer } : {}),
  }
}
const edge = (from: string, to: string): GraphModelEdge => ({ from, to })

describe("computeLayout", () => {
  it("places a linear chain left → right in ascending layers", () => {
    const nodes = [node("a"), node("b"), node("c")]
    const edges = [edge("a", "b"), edge("b", "c")]
    const { nodes: placed } = computeLayout(nodes, edges)

    const a = placed.get("a")!
    const b = placed.get("b")!
    const c = placed.get("c")!
    expect(a.layer).toBe(0)
    expect(b.layer).toBe(1)
    expect(c.layer).toBe(2)
    expect(a.x).toBeLessThan(b.x)
    expect(b.x).toBeLessThan(c.x)
  })

  it("honors the server's layer hint when present", () => {
    // No edges, but explicit layers → still ranks by the hint.
    const nodes = [node("src", 0), node("mid", 1), node("sink", 2)]
    const { nodes: placed } = computeLayout(nodes, [])
    expect(placed.get("src")!.x).toBeLessThan(placed.get("mid")!.x)
    expect(placed.get("mid")!.x).toBeLessThan(placed.get("sink")!.x)
  })

  it("fans a Route out: branches share a layer, sinks the next", () => {
    const nodes = [
      node("src"),
      node("route"),
      node("b1"),
      node("b2"),
      node("s1"),
      node("s2"),
    ]
    const edges = [
      edge("src", "route"),
      edge("route", "b1"),
      edge("route", "b2"),
      edge("b1", "s1"),
      edge("b2", "s2"),
    ]
    const { nodes: placed } = computeLayout(nodes, edges)
    expect(placed.get("src")!.layer).toBe(0)
    expect(placed.get("route")!.layer).toBe(1)
    expect(placed.get("b1")!.layer).toBe(2)
    expect(placed.get("b2")!.layer).toBe(2)
    expect(placed.get("s1")!.layer).toBe(3)
    expect(placed.get("s2")!.layer).toBe(3)
    // Two nodes in the same layer get distinct rows (no overlap).
    expect(placed.get("b1")!.y).not.toBe(placed.get("b2")!.y)
  })

  it("is deterministic (same graph → identical positions)", () => {
    const nodes = [node("a"), node("b"), node("c")]
    const edges = [edge("a", "b"), edge("a", "c")]
    const first = computeLayout(nodes, edges)
    const second = computeLayout(nodes, edges)
    for (const id of ["a", "b", "c"]) {
      expect(first.nodes.get(id)).toEqual(second.nodes.get(id))
    }
  })
})
