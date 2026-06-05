import {
  type ConstructNode,
  resetNodeIdCounter,
  synthesizeApp,
} from "@flink-reactor/dsl"
import { beforeEach, describe, expect, it } from "vitest"
import pipeline from "../../pipelines/tapped/index.js"

// A second pipeline test file: discovery groups it under its own pipeline,
// and its single load-bearing assertion passes (no snapshot involved).

function synth(node: ConstructNode): string {
  const result = synthesizeApp({ name: "tapped", children: [node] })
  return result.pipelines[0].sql.sql
}

describe("tapped pipeline", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it("contains load-bearing SQL", () => {
    const sql = synth(pipeline)

    expect(sql).toMatch(/CREATE TABLE/)
  })
})
