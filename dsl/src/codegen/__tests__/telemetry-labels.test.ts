import { beforeEach, describe, expect, it } from "vitest"
import {
  type FlinkDeploymentCrd,
  generateCrd,
} from "@/codegen/crd-generator.js"
import {
  generateSql,
  generateTapManifest,
} from "@/codegen/sql/sql-generator.js"
import { Pipeline } from "@/components/pipeline.js"
import { KafkaSink } from "@/components/sinks.js"
import { KafkaSource, PostgresCdcPipelineSource } from "@/components/sources.js"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { generatePipelineManifest } from "@/core/manifest.js"
import { Field, Schema } from "@/core/schema.js"
import { secretRef } from "@/core/secret-ref.js"

const EventSchema = Schema({
  fields: { id: Field.BIGINT() },
})

const LABELS = { team: "payments", tier: "critical" }

function labeledPipeline() {
  return Pipeline({
    name: "labeled",
    telemetry: { labels: LABELS },
    children: KafkaSink({
      topic: "out",
      format: "json",
      bootstrapServers: "k:9092",
      children: KafkaSource({
        topic: "in",
        format: "json",
        bootstrapServers: "k:9092",
        schema: EventSchema,
      }),
    }),
  })
}

describe("telemetry labels → CRD", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it("stamps labels on metadata and a metadata-only pod template", () => {
    const crd = generateCrd(labeledPipeline(), {
      flinkVersion: "2.0",
    }) as FlinkDeploymentCrd

    expect(crd.metadata.labels).toEqual(LABELS)
    expect(crd.spec.podTemplate).toEqual({
      metadata: { labels: LABELS },
    })
  })

  it("omits labels and pod template entirely when telemetry is absent", () => {
    resetNodeIdCounter()
    const plain = Pipeline({
      name: "plain",
      children: KafkaSink({
        topic: "out",
        format: "json",
        bootstrapServers: "k:9092",
        children: KafkaSource({
          topic: "in",
          format: "json",
          bootstrapServers: "k:9092",
          schema: EventSchema,
        }),
      }),
    })

    const crd = generateCrd(plain, {
      flinkVersion: "2.0",
    }) as FlinkDeploymentCrd

    expect(crd.metadata.labels).toBeUndefined()
    expect(crd.spec.podTemplate).toBeUndefined()
  })

  it("explicit generator labels win over telemetry labels on collision", () => {
    const crd = generateCrd(labeledPipeline(), {
      flinkVersion: "2.0",
      labels: { tier: "override", extra: "from-options" },
    }) as FlinkDeploymentCrd

    expect(crd.metadata.labels).toEqual({
      team: "payments",
      tier: "override",
      extra: "from-options",
    })
  })

  it("merges pod labels into the pipeline-connector pod template", () => {
    const cdc = Pipeline({
      name: "cdc-labeled",
      telemetry: { labels: LABELS },
      children: PostgresCdcPipelineSource({
        hostname: "pg",
        database: "app",
        schemaList: ["public"],
        tableList: ["public.users"],
        username: "app",
        password: secretRef("pg-pass"),
        schema: EventSchema,
      }),
    })

    const crd = generateCrd(cdc, { flinkVersion: "2.0" }) as FlinkDeploymentCrd
    const podTemplate = crd.spec.podTemplate as {
      metadata?: { labels?: Record<string, string> }
      spec?: { containers: unknown[] }
    }

    expect(podTemplate.metadata?.labels).toEqual(LABELS)
    // The CDC pod template still carries its volume-mount spec.
    expect(podTemplate.spec?.containers).toBeDefined()
  })
})

describe("telemetry labels → manifests + banner", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it("carries labels on the tap manifest", () => {
    const { manifest } = generateTapManifest(labeledPipeline(), {
      devMode: true,
    })

    expect(manifest?.labels).toEqual(LABELS)
  })

  it("carries labels on the pipeline manifest", () => {
    const manifest = generatePipelineManifest(labeledPipeline())

    expect(manifest.labels).toEqual(LABELS)
  })

  it("renders a labels line in the pipeline SET banner", () => {
    const result = generateSql(labeledPipeline())

    const banner = result.statements
      .filter((_, i) => result.commentIndices.has(i))
      .join("\n")
    expect(banner).toContain("labels")
    expect(banner).toContain("team=payments, tier=critical")
  })

  it("omits the labels field when telemetry is absent", () => {
    resetNodeIdCounter()
    const plain = Pipeline({
      name: "plain",
      children: KafkaSink({
        topic: "out",
        format: "json",
        bootstrapServers: "k:9092",
        children: KafkaSource({
          topic: "in",
          format: "json",
          bootstrapServers: "k:9092",
          schema: EventSchema,
        }),
      }),
    })

    const { manifest } = generateTapManifest(plain, { devMode: true })
    expect(manifest?.labels).toBeUndefined()
    expect(generatePipelineManifest(plain).labels).toBeUndefined()
  })
})
