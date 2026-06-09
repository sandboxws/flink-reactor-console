// Failure-path contract: a broken pipeline exits non-zero in human mode
// and produces an ok:false machine-readable envelope in --json mode.

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  createE2eContext,
  type E2eContext,
  type E2eProject,
} from "./helpers/test-context.js"

// An orphan source: declared under Pipeline but consumed by nothing.
// Written against the INSTALLED package — factory calls, no JSX, so no
// transpiler configuration is exercised beyond what the CLI itself does.
const ORPHAN_PIPELINE = `
import { Field, KafkaSource, Pipeline, Schema } from "@flink-reactor/dsl"

const orphan = Pipeline({
  name: "broken",
  children: KafkaSource({
    topic: "in",
    format: "json",
    bootstrapServers: "k:9092",
    schema: Schema({ fields: { id: Field.BIGINT() } }),
  }),
})

export default orphan
`

describe("validate failure path (starter + broken pipeline)", () => {
  let ctx: E2eContext
  let project: E2eProject

  beforeAll(async () => {
    ctx = createE2eContext()
    project = await ctx.scaffold("starter", { name: "broken-app" })
    project.writeFile("pipelines/broken/index.tsx", ORPHAN_PIPELINE)
  }, 600_000)

  afterAll(() => {
    ctx.cleanupAll()
  })

  it("validate exits non-zero and names the orphan source", async () => {
    const result = await project.validate()

    expect(result.exitCode).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/orphan source/i)
  })

  it("validate --json emits ok:false with the structured diagnostic", async () => {
    const { result, envelope } = await project.runJson(["validate"])

    expect(result.exitCode).not.toBe(0)
    expect(envelope.ok).toBe(false)
    const broken = envelope.pipelines.find((p) => p.name === "broken") as {
      ok: boolean
      errors: ReadonlyArray<{ message: string }>
    }
    expect(broken).toBeDefined()
    expect(broken.ok).toBe(false)
    expect(broken.errors.some((e) => /orphan source/i.test(e.message))).toBe(
      true,
    )
  })

  it("the healthy pipeline still validates inside the same project", async () => {
    const { envelope } = await project.runJson(["validate"])

    const healthy = envelope.pipelines.find(
      (p) => p.name === "hello-world",
    ) as { ok: boolean }
    expect(healthy).toBeDefined()
    expect(healthy.ok).toBe(true)
  })
})
