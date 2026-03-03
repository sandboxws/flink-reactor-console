import { beforeEach, describe, expect, it } from "vitest"
import { generateMockTapManifest } from "@/data/mock-tap-manifest"
import type { TapManifest, TapMetadata } from "@/data/tap-types"
import {
  buildRuntimeObservationSql,
  getAvailableOperators,
} from "./tap-manifest"

// ---------------------------------------------------------------------------
// getAvailableOperators
// ---------------------------------------------------------------------------

describe("getAvailableOperators", () => {
  it("sorts operators by component type (sources first, sinks last)", () => {
    const manifest = generateMockTapManifest()
    const operators = getAvailableOperators(manifest)

    const types = operators.map((op) => op.componentType)
    // Sources should come before transforms, transforms before sinks
    const sourceIdx = types.indexOf("source")
    const transformIdx = types.indexOf("transform")
    const sinkIdx = types.indexOf("sink")

    expect(sourceIdx).toBeLessThan(transformIdx)
    expect(transformIdx).toBeLessThan(sinkIdx)
  })

  it("returns all operators from the manifest", () => {
    const manifest = generateMockTapManifest()
    const operators = getAvailableOperators(manifest)
    expect(operators.length).toBe(manifest.taps.length)
  })

  it("returns empty array for manifest with no taps", () => {
    const manifest: TapManifest = {
      pipelineName: "test",
      flinkVersion: "1.20",
      generatedAt: new Date().toISOString(),
      taps: [],
    }
    const operators = getAvailableOperators(manifest)
    expect(operators).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// buildRuntimeObservationSql
// ---------------------------------------------------------------------------

describe("buildRuntimeObservationSql", () => {
  let kafkaSource: TapMetadata

  beforeEach(() => {
    const manifest = generateMockTapManifest()
    kafkaSource = manifest.taps[0] // orders-source (kafka)
  })

  it("overrides the consumer group ID with session suffix", () => {
    const sql = buildRuntimeObservationSql(kafkaSource, {
      offsetMode: "latest",
      sessionId: "abc12345",
    })

    expect(sql).toContain(
      `'properties.group.id' = '${kafkaSource.consumerGroupId}-abc12345'`,
    )
    // Original group ID should NOT appear without the suffix
    expect(sql).not.toContain(
      `'properties.group.id' = '${kafkaSource.consumerGroupId}'`,
    )
  })

  it("overrides offset mode to earliest-offset", () => {
    const sql = buildRuntimeObservationSql(kafkaSource, {
      offsetMode: "earliest",
      sessionId: "test1",
    })

    expect(sql).toContain("'scan.startup.mode' = 'earliest-offset'")
    expect(sql).not.toContain("'scan.startup.mode' = 'latest-offset'")
  })

  it("overrides offset mode to timestamp with millis", () => {
    const startTs = "2026-01-15T10:00:00.000Z"
    const sql = buildRuntimeObservationSql(kafkaSource, {
      offsetMode: "timestamp",
      startTimestamp: startTs,
      sessionId: "test2",
    })

    expect(sql).toContain("'scan.startup.mode' = 'timestamp'")
    expect(sql).toContain(
      `'scan.startup.timestamp-millis' = '${new Date(startTs).getTime()}'`,
    )
  })

  it("keeps latest-offset when offset mode is latest", () => {
    const sql = buildRuntimeObservationSql(kafkaSource, {
      offsetMode: "latest",
      sessionId: "test3",
    })

    expect(sql).toContain("'scan.startup.mode' = 'latest-offset'")
  })
})
