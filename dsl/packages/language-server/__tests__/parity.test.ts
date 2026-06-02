import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { buildPositionMap } from "../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

// Structurally-valid fixtures whose default export resolves to a tree.
const PARITY_FIXTURES = [
  "valid-pipeline.tsx",
  "fn-default-pipeline.tsx",
  "branching-pipeline.tsx",
]

describe("source-position predictor parity (critical gate)", () => {
  for (const fixture of PARITY_FIXTURES) {
    it(`predicts the authoritative id set for ${fixture}`, async () => {
      const entryPoint = join(FIXTURES, fixture)

      // Authoritative IDs: run real synthesis and read the loaded tree.
      const result = await synthesizeDocument({
        entryPoint,
        projectDir: FIXTURES,
      })
      expect(result.ok).toBe(true)
      const authoritativeIds = new Set(result.nodes.map((n) => n.id))

      // Predicted IDs: parse the source and re-derive ids from the AST.
      const sourceText = readFileSync(entryPoint, "utf-8")
      const { map, mismatch } = buildPositionMap(
        sourceText,
        entryPoint,
        result.nodes,
      )
      const predictedIds = new Set(map.keys())

      // The element/node counts must line up (no mismatch warning).
      expect(mismatch).toBeUndefined()

      // The predicted id SET must equal the authoritative set. Because counter
      // suffixes (`Filter_1`, `Pipeline_4`) encode creation order, set equality
      // also proves the post-order traversal is correct.
      expect([...predictedIds].sort()).toEqual([...authoritativeIds].sort())

      // Every statement-origin node must be locatable.
      for (const origin of result.statementOrigins) {
        expect(predictedIds.has(origin.nodeId)).toBe(true)
      }
    })
  }

  it("locates a name-derived source by its topic (orders) and the Pipeline", async () => {
    const entryPoint = join(FIXTURES, "valid-pipeline.tsx")
    const result = await synthesizeDocument({
      entryPoint,
      projectDir: FIXTURES,
    })
    const sourceText = readFileSync(entryPoint, "utf-8")
    const { map } = buildPositionMap(sourceText, entryPoint, result.nodes)

    // KafkaSource → "orders"; the range should point at its JSX line.
    const orders = map.get("orders")
    expect(orders).toBeDefined()
    expect(sourceText.split("\n")[orders!.start.line]).toContain("KafkaSource")
  })

  it("maps dot-notation components (Route.Branch / Route.Default)", async () => {
    const entryPoint = join(FIXTURES, "branching-pipeline.tsx")
    const result = await synthesizeDocument({
      entryPoint,
      projectDir: FIXTURES,
    })
    const sourceText = readFileSync(entryPoint, "utf-8")
    const { map } = buildPositionMap(sourceText, entryPoint, result.nodes)

    // The two named sinks under the branches resolve by name.
    expect(map.has("big")).toBe(true)
    expect(map.has("rest")).toBe(true)
  })
})
