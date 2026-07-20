import { describe, expect, it } from "vitest"
import type { KafkaSeededTopic, KafkaSeedResult } from "@/lib/instruments-data"
import {
  availableDomains,
  confirmLabel,
  domainsArgument,
  filterRowsByDomains,
  nothingToSeed,
  planSummary,
  resultLine,
  rowStatus,
} from "./kafka-seed-derive"

function row(over: Partial<KafkaSeededTopic>): KafkaSeededTopic {
  return {
    topic: "t",
    domain: "ecommerce",
    existed: false,
    existingRecords: 0,
    created: false,
    skipped: false,
    recordsProduced: 0,
    error: null,
    ...over,
  }
}

describe("availableDomains / filterRowsByDomains", () => {
  const rows = [
    row({ topic: "a", domain: "iot" }),
    row({ topic: "b", domain: "ecommerce" }),
    row({ topic: "c", domain: "iot" }),
  ]

  it("collects unique sorted domains", () => {
    expect(availableDomains(rows)).toEqual(["ecommerce", "iot"])
  })

  it("empty selection means all rows", () => {
    expect(filterRowsByDomains(rows, [])).toHaveLength(3)
  })

  it("filters by selected domains", () => {
    expect(filterRowsByDomains(rows, ["iot"]).map((r) => r.topic)).toEqual([
      "a",
      "c",
    ])
  })
})

describe("planSummary / confirmLabel / nothingToSeed", () => {
  it("counts seedable, skipped, and errored rows separately", () => {
    const summary = planSummary([
      row({ recordsProduced: 2 }),
      row({ recordsProduced: 3 }),
      row({ skipped: true, existingRecords: 5 }),
      row({ error: "boom", recordsProduced: 1 }),
    ])
    expect(summary).toEqual({ topics: 2, records: 5, skipped: 1, errored: 1 })
    expect(nothingToSeed(summary)).toBe(false)
    expect(confirmLabel(summary)).toBe("Seed 5 records into 2 topics")
  })

  it("reports nothing to seed when every row is skipped", () => {
    const summary = planSummary([row({ skipped: true, existingRecords: 2 })])
    expect(nothingToSeed(summary)).toBe(true)
    expect(confirmLabel(summary)).toBe("Nothing to seed")
  })

  it("uses singular forms for one record into one topic", () => {
    const summary = planSummary([row({ recordsProduced: 1 })])
    expect(confirmLabel(summary)).toBe("Seed 1 record into 1 topic")
  })
})

describe("rowStatus", () => {
  it("labels a missing topic as will-create", () => {
    expect(rowStatus(row({}))).toEqual({ label: "will create", tone: "create" })
  })

  it("labels an existing populated topic as append with the count", () => {
    expect(rowStatus(row({ existed: true, existingRecords: 1200 }))).toEqual({
      label: "append · 1,200 existing",
      tone: "append",
    })
  })

  it("labels an existing empty topic", () => {
    expect(rowStatus(row({ existed: true }))).toEqual({
      label: "exists · empty",
      tone: "append",
    })
  })

  it("labels skipped rows with the existing count", () => {
    expect(
      rowStatus(row({ skipped: true, existed: true, existingRecords: 3 })),
    ).toEqual({ label: "skip · 3 records", tone: "skip" })
  })

  it("surfaces per-topic errors verbatim", () => {
    expect(rowStatus(row({ error: "produce failed" }))).toEqual({
      label: "produce failed",
      tone: "error",
    })
  })
})

describe("domainsArgument", () => {
  it("omits the argument for an empty selection", () => {
    expect(domainsArgument([])).toBeUndefined()
  })

  it("copies the selection otherwise", () => {
    expect(domainsArgument(["iot"])).toEqual(["iot"])
  })
})

describe("resultLine", () => {
  function result(over: Partial<KafkaSeedResult>): KafkaSeedResult {
    return { topics: [], recordsProduced: 0, skipped: [], dryRun: false, ...over }
  }

  it("summarizes a real run with skips and failures", () => {
    expect(
      resultLine(
        result({
          topics: [
            row({ recordsProduced: 2 }),
            row({ skipped: true }),
            row({ error: "x" }),
          ],
        }),
      ),
    ).toBe("Seeded 2 records across 1 topic · 1 skipped · 1 failed")
  })

  it("uses conditional phrasing for dry runs", () => {
    expect(
      resultLine(result({ dryRun: true, topics: [row({ recordsProduced: 4 })] })),
    ).toBe("Would seed 4 records across 1 topic")
  })
})
