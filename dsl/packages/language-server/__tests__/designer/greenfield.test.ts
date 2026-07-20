// Greenfield generator (visual-designer tasks 5.1–5.3): deterministic
// byte-identical output, template-convention shape, and a REAL synthesis of
// the generated file proving it produces the graph the canvas described.

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { generatePipelineFile } from "../../src/designer/greenfield.js"
import type { GenerateEdit } from "../../src/designer/model.js"
import { verifyStaticSubset } from "../../src/designer/static-subset.js"
import { synthesizeDocument } from "../../src/synth/runner.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
// Inside the package so `@flink-reactor/dsl` resolves for the loader.
const TMP = join(FIXTURES, ".tmp-greenfield")

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

const CANVAS: GenerateEdit = {
  kind: "generate",
  pipelineName: "designed-orders",
  nodes: [
    {
      component: "KafkaSource",
      props: { topic: "orders", bootstrapServers: "kafka:9092" },
      identifierProps: {
        schema: { identifier: "OrdersSchema", importFrom: "./schemas" },
      },
    },
    {
      component: "Filter",
      props: { condition: "amount > 100" },
    },
    {
      component: "KafkaSink",
      props: { topic: "big-orders", bootstrapServers: "kafka:9092" },
    },
  ],
}

describe("greenfield generator", () => {
  it("emits a deterministic, byte-identical file for the same canvas", () => {
    const a = generatePipelineFile(CANVAS)
    const b = generatePipelineFile(CANVAS)
    expect(a).toBe(b)
    expect(a).toMatchSnapshot()
  })

  it("follows the project pipeline conventions and the static-subset contract", () => {
    const text = generatePipelineFile(CANVAS)
    // Entry-point shape + import style (template parity).
    expect(text).toMatch(/^\/\/ @flink-reactor designer\n/)
    expect(text).toContain(
      "import { Pipeline, KafkaSource, Filter, KafkaSink } from '@flink-reactor/dsl';",
    )
    expect(text).toContain("import { OrdersSchema } from './schemas';")
    expect(text).toContain("export default (")
    expect(text).toContain('<Pipeline name="designed-orders">')
    expect(text).toContain("schema={OrdersSchema}")
    // Generated output is designer-managed by construction.
    const subset = verifyStaticSubset(text, "generated.tsx")
    expect(subset.pragmaPresent).toBe(true)
    expect(subset.violations).toEqual([])
  })

  it("synthesizes to the graph the canvas described", async () => {
    mkdirSync(TMP, { recursive: true })
    writeFileSync(
      join(TMP, "schemas.ts"),
      `import { Field, Schema } from "@flink-reactor/dsl"

export const OrdersSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})
`,
      "utf8",
    )
    const entryPoint = join(TMP, "designed-orders.tsx")
    writeFileSync(entryPoint, generatePipelineFile(CANVAS), "utf8")

    const result = await synthesizeDocument({ entryPoint, projectDir: TMP })
    expect(result.loadError).toBeUndefined()
    expect(result.ok).toBe(true)

    const components = result.nodes.map((n) => n.component)
    expect(components).toContain("KafkaSource")
    expect(components).toContain("Filter")
    expect(components).toContain("KafkaSink")

    // The linear chain the canvas described: source → filter → sink.
    const idOf = (component: string) =>
      result.nodes.find((n) => n.component === component)?.id ?? ""
    expect(result.dagEdges).toEqual(
      expect.arrayContaining([
        { from: idOf("KafkaSource"), to: idOf("Filter") },
        { from: idOf("Filter"), to: idOf("KafkaSink") },
      ]),
    )
  })
})
