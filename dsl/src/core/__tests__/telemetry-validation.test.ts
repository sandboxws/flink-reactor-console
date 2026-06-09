import { beforeEach, describe, expect, it } from "vitest"
import { Pipeline } from "@/components/pipeline.js"
import { KafkaSink } from "@/components/sinks.js"
import { KafkaSource } from "@/components/sources.js"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { Field, Schema } from "@/core/schema.js"
import {
  MAX_TELEMETRY_LABELS,
  RESERVED_TELEMETRY_LABEL_KEYS,
  validateTelemetryLabels,
} from "@/core/telemetry-validation.js"

const EventSchema = Schema({
  fields: { id: Field.BIGINT() },
})

function chain() {
  return KafkaSink({
    topic: "out",
    format: "json",
    bootstrapServers: "k:9092",
    children: KafkaSource({
      topic: "in",
      format: "json",
      bootstrapServers: "k:9092",
      schema: EventSchema,
    }),
  })
}

function pipelineWithLabels(labels: Record<string, string>) {
  return Pipeline({
    name: "labeled",
    telemetry: { labels },
    children: chain(),
  })
}

describe("validateTelemetryLabels", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it("accepts valid labels", () => {
    const root = pipelineWithLabels({
      team: "payments",
      tier: "critical",
      dataset: "orders.v2",
      cost_center: "cc-1042",
    })

    expect(validateTelemetryLabels(root)).toEqual([])
  })

  it.each([
    ["9starts", "leading digit"],
    ["has-dash", "dash in key"],
    ["trailing_", "trailing underscore"],
    ["_leading", "leading underscore"],
    ["has space", "space in key"],
    ["a".repeat(64), "64-char key"],
  ])("rejects key %s (%s)", (key) => {
    const diags = validateTelemetryLabels(pipelineWithLabels({ [key]: "v" }))

    expect(diags).toHaveLength(1)
    expect(diags[0].severity).toBe("error")
    expect(diags[0].category).toBe("structure")
    expect(diags[0].component).toBe("Pipeline")
  })

  it.each([
    ["-leading", "leading dash"],
    ["trailing-", "trailing dash"],
    ["has space", "space in value"],
    ["b".repeat(64), "64-char value"],
  ])("rejects value %s (%s)", (value) => {
    const diags = validateTelemetryLabels(pipelineWithLabels({ tier: value }))

    expect(diags).toHaveLength(1)
    expect(diags[0].message).toContain("value")
  })

  it("allows empty values", () => {
    expect(validateTelemetryLabels(pipelineWithLabels({ tier: "" }))).toEqual(
      [],
    )
  })

  it("rejects more than the maximum label count", () => {
    const labels: Record<string, string> = {}
    for (let i = 0; i < MAX_TELEMETRY_LABELS + 1; i++) {
      labels[`label_${i}`] = "v"
    }

    const diags = validateTelemetryLabels(pipelineWithLabels(labels))

    expect(diags).toHaveLength(1)
    expect(diags[0].message).toContain(`${MAX_TELEMETRY_LABELS + 1}`)
  })

  it.each([
    ...RESERVED_TELEMETRY_LABEL_KEYS,
  ])("rejects reserved key %s", (key) => {
    const diags = validateTelemetryLabels(pipelineWithLabels({ [key]: "x" }))

    expect(diags).toHaveLength(1)
    expect(diags[0].message).toContain("reserved")
  })

  it("returns nothing for a tree without telemetry", () => {
    const root = Pipeline({ name: "plain", children: chain() })
    expect(validateTelemetryLabels(root)).toEqual([])
  })

  it("returns nothing for a tree without a Pipeline node", () => {
    expect(validateTelemetryLabels(chain())).toEqual([])
  })
})
