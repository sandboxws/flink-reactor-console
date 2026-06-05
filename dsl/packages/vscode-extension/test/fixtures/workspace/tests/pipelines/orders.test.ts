import {
  type ConstructNode,
  resetNodeIdCounter,
  synthesizeApp,
} from "@flink-reactor/dsl"
import { beforeEach, describe, expect, it } from "vitest"
import pipeline from "../../pipelines/orders/index.js"

// Test-explorer e2e fixture, shaped on `templatePipelineTestStub`: a SQL
// snapshot pinned STALE in `__snapshots__/` (fails with a mismatch → the
// golden diff), a passing load-bearing `toMatch`, a failing `toMatch`
// (ordinary assertion → inline-message fallback), and a stale OBJECT
// snapshot (non-SQL mismatch → no golden diff).

function synth(node: ConstructNode): string {
  const result = synthesizeApp({ name: "orders", children: [node] })
  return result.pipelines[0].sql.sql
}

describe("orders pipeline", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it("synthesizes stable SQL", () => {
    const sql = synth(pipeline)

    expect(sql).toMatchSnapshot()
  })

  it("contains load-bearing SQL", () => {
    const sql = synth(pipeline)

    expect(sql).toMatch(/INSERT INTO/)
  })

  it("flags a missing token", () => {
    const sql = synth(pipeline)

    expect(sql).toMatch(/NO_SUCH_TOKEN_XYZ/)
  })

  it("snapshots the deployment kind", () => {
    expect({ kind: "FlinkDeployment" }).toMatchSnapshot()
  })
})
