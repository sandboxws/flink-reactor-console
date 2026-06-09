import { beforeEach, describe, expect, it } from "vitest"
import {
  type FlinkDeploymentCrd,
  generateCrd,
} from "@/codegen/crd-generator.js"
import { generateSql } from "@/codegen/sql/sql-generator.js"
import { Pipeline } from "@/components/pipeline.js"
import { KafkaSink } from "@/components/sinks.js"
import { GenericSource } from "@/components/sources.js"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { Field, Schema } from "@/core/schema.js"
import { SENSITIVE_VALUE_MASK } from "@/core/sensitive-options.js"

const EventSchema = Schema({
  fields: { id: Field.BIGINT() },
})

const SECRET = "org.apache.kafka required password=hunter2;"

function pipelineWithSecret() {
  return Pipeline({
    name: "secretive",
    children: KafkaSink({
      topic: "out",
      format: "json",
      bootstrapServers: "k:9092",
      children: GenericSource({
        connector: "kafka",
        schema: EventSchema,
        options: { "properties.sasl.jaas.config": SECRET },
      }),
    }),
  })
}

function decodeEmbeddedSql(crd: unknown): string {
  const deployment = crd as FlinkDeploymentCrd
  expect(deployment.kind).toBe("FlinkDeployment")
  const params =
    deployment.spec.flinkConfiguration["pipeline.global-job-parameters"]
  const entry = params.split(",").find((e) => e.startsWith("pipeline.sql.b64:"))
  expect(entry).toBeDefined()
  const b64 = (entry as string).slice("pipeline.sql.b64:".length)
  return Buffer.from(b64, "base64").toString("utf-8")
}

describe("secret redaction: executable vs display surfaces", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it("keeps the raw value in executable DDL but masks the banner comment", () => {
    const result = generateSql(pipelineWithSecret())

    const executable = result.statements.filter(
      (_, i) => !result.commentIndices.has(i),
    )
    const banners = result.statements.filter((_, i) =>
      result.commentIndices.has(i),
    )

    // Executable CREATE TABLE carries the literal — Flink needs it.
    expect(executable.join("\n")).toContain(SECRET)
    // The banner (display) line for the same option is masked.
    const bannerText = banners.join("\n")
    expect(bannerText).toContain("properties.sasl.jaas.config")
    expect(bannerText).not.toContain(SECRET)
    expect(bannerText).toContain(SENSITIVE_VALUE_MASK)
  })

  it("masks statementMeta details while leaving DDL untouched", () => {
    const result = generateSql(pipelineWithSecret())

    const allDetails = [...result.statementMeta.values()].flatMap(
      (m) => m.details,
    )
    const jaas = allDetails.find((d) => d.key === "properties.sasl.jaas.config")
    expect(jaas?.value).toBe(SENSITIVE_VALUE_MASK)
  })

  it("redacts the CRD-embedded SQL copy by default", () => {
    const sql = generateSql(pipelineWithSecret()).sql
    resetNodeIdCounter()
    const crd = generateCrd(pipelineWithSecret(), {
      flinkVersion: "2.0",
      sourceSql: sql,
    })

    const embedded = decodeEmbeddedSql(crd)
    expect(embedded).not.toContain(SECRET)
    expect(embedded).toContain(SENSITIVE_VALUE_MASK)
  })

  it("keeps the raw copy when redactSourceSql is false (--no-redact-metadata)", () => {
    const sql = generateSql(pipelineWithSecret()).sql
    resetNodeIdCounter()
    const crd = generateCrd(pipelineWithSecret(), {
      flinkVersion: "2.0",
      sourceSql: sql,
      redactSourceSql: false,
    })

    expect(decodeEmbeddedSql(crd)).toContain(SECRET)
  })
})
