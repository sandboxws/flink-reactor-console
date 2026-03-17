import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { analyzePlan, detectFormat, parsePlan } from "./index"
import type { FlinkAntiPatternType } from "./types"

const FIXTURES_DIR = join(__dirname, "__fixtures__")

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8")
}

function fixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR).filter(
    (f) => f.endsWith(".json") || f.endsWith(".text"),
  )
}

// ─── Format Detection ──────────────────────────────────────────────

describe("detectFormat", () => {
  it("detects JSON format", () => {
    const input = loadFixture("01-simple-source-sink.json")
    expect(detectFormat(input)).toBe("json")
  })

  it("detects text format", () => {
    const input = loadFixture("13-text-simple-etl.text")
    expect(detectFormat(input)).toBe("text")
  })
})

// ─── Parser Regression ─────────────────────────────────────────────

describe("parsePlan", () => {
  const fixtures = fixtureNames()

  it.each(fixtures)("parses %s without throwing", (name) => {
    const input = loadFixture(name)
    const plan = parsePlan(input)

    expect(plan).toBeDefined()
    expect(plan.root).toBeDefined()
    expect(plan.totalNodes).toBeGreaterThan(0)
    expect(plan.maxDepth).toBeGreaterThanOrEqual(0)
    expect(plan.format).toBeTruthy()
    expect(plan.jobType).toMatch(/^(STREAMING|BATCH)$/)
  })

  it("parses simple source-sink correctly", () => {
    const input = loadFixture("01-simple-source-sink.json")
    const plan = parsePlan(input)

    expect(plan.totalNodes).toBe(2)
    expect(plan.root.category).toBe("sink")
    expect(plan.root.children).toHaveLength(1)
    expect(plan.root.children[0].category).toBe("source")
  })

  it("parses multi-stream join correctly", () => {
    const input = loadFixture("08-complex-multi-stream-join.json")
    const plan = parsePlan(input)

    expect(plan.totalNodes).toBeGreaterThan(5)
  })

  it("detects BATCH job type", () => {
    const input = loadFixture("23-bounded-batch-etl.json")
    const plan = parsePlan(input)

    expect(plan.jobType).toBe("BATCH")
  })

  it("parses branching plans with multiple sinks", () => {
    const input = loadFixture("21-branching-multi-sink.json")
    const plan = parsePlan(input)

    // Should have a virtual root connecting multiple sinks
    expect(plan.totalNodes).toBeGreaterThan(3)
  })

  it("parses text format plans", () => {
    const input = loadFixture("13-text-simple-etl.text")
    const plan = parsePlan(input)

    expect(plan.format).toBe("text")
    expect(plan.totalNodes).toBeGreaterThan(1)
  })
})

// ─── Analyzer Regression ────────────────────────────────────────────

describe("analyzePlan", () => {
  const fixtures = fixtureNames()

  it.each(fixtures)("analyzes %s without throwing", (name) => {
    const input = loadFixture(name)
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    expect(result).toBeDefined()
    expect(result.id).toBeTruthy()
    expect(result.name).toBeTruthy()
    expect(result.antiPatterns).toBeDefined()
    expect(result.bottlenecks).toBeDefined()
    expect(result.recommendations).toBeDefined()
    expect(result.stateForecasts).toBeDefined()
    expect(result.watermarkHealth).toBeDefined()
    expect(result.workloadType).toMatch(/^(OLTP|OLAP|Mixed)$/)
  })

  it("detects unbounded state in regular join", () => {
    const input = loadFixture("09-anti-pattern-unbounded-join.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).toContain("unbounded-state-join")
  })

  it("detects data skew with low-cardinality keys", () => {
    const input = loadFixture("10-anti-pattern-data-skew.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).toContain("data-skew-low-cardinality")
  })

  it("detects missing watermark", () => {
    const input = loadFixture("17-anti-pattern-no-watermark.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).toContain("missing-watermark")
  })

  it("does not flag sync-lookup or no-cache for explicit async+cache config", () => {
    const input = loadFixture("07-complex-lookup-join.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).not.toContain("sync-lookup-join")
    expect(types).not.toContain("lookup-no-cache")
  })

  it("detects changelog incompatibility", () => {
    const input = loadFixture("29-changelog-transform.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).toContain("changelog-incompatible")
    // Should NOT produce false positives
    expect(types).not.toContain("data-skew-null-key")
    expect(types).not.toContain("hash-before-skew")
  })

  it("handles absent lookup fields without false warnings", () => {
    const input = loadFixture("30-lookup-join-absent-fields.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).not.toContain("sync-lookup-join")
    expect(types).not.toContain("lookup-no-cache")
  })

  it("parses text format without hash-before-skew false positive", () => {
    const input = loadFixture("31-text-relation-extraction.text")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    const types = result.antiPatterns.map((p) => p.type)
    expect(types).not.toContain("hash-before-skew")
  })

  it("generates state forecasts for stateful operators", () => {
    const input = loadFixture("03-medium-group-aggregate.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    expect(result.stateForecasts.length).toBeGreaterThan(0)
    for (const forecast of result.stateForecasts) {
      expect(forecast.estimatedSize1h).toBeGreaterThan(0)
      expect(forecast.estimatedSize24h).toBeGreaterThanOrEqual(
        forecast.estimatedSize1h,
      )
    }
  })

  it("generates recommendations sorted by severity", () => {
    const input = loadFixture("09-anti-pattern-unbounded-join.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    expect(result.recommendations.length).toBeGreaterThan(0)

    const severityOrder = { critical: 0, warning: 1, optimization: 2 }
    for (let i = 1; i < result.recommendations.length; i++) {
      const prev = severityOrder[result.recommendations[i - 1].severity]
      const curr = severityOrder[result.recommendations[i].severity]
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })

  it("identifies bottlenecks", () => {
    const input = loadFixture("08-complex-multi-stream-join.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    expect(result.bottlenecks.length).toBeGreaterThan(0)
    for (const bottleneck of result.bottlenecks) {
      expect(bottleneck.percentage).toBeGreaterThan(0)
      expect(bottleneck.reason).toBeTruthy()
    }
  })

  it("classifies window plans as OLAP", () => {
    const input = loadFixture("04-medium-tumble-window.json")
    const plan = parsePlan(input)
    const result = analyzePlan(plan)

    expect(result.workloadType).toBe("OLAP")
  })
})
