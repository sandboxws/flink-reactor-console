import { describe, expect, it, vi } from "vitest"
import type { SeedSubject } from "@/cli/cluster/schema-registry-seed.js"
import {
  collectDeclaredKafkaTopics,
  seedKafkaSampleData,
  selectSubjectsForTopics,
  sumOffsetOutput,
} from "@/cli/cluster/seed-sample-data.js"
import type { FlinkReactorConfig } from "@/core/config.js"

const subjects: SeedSubject[] = [
  {
    topic: "page-views",
    domain: "analytics",
    jsonSchema: {},
    sampleRows: [{ a: 1 }, { a: 2 }],
  },
  {
    topic: "ecom.orders",
    domain: "ecommerce",
    jsonSchema: {},
    sampleRows: [{ id: "o1" }],
  },
  { topic: "no-rows", domain: "iot", jsonSchema: {} },
]

describe("collectDeclaredKafkaTopics", () => {
  it("unions kafka sources, sim topics, and catalog table topics (sorted, deduped)", () => {
    const config: FlinkReactorConfig = {
      sources: {
        pv: { type: "kafka", topic: "page-views" },
        // Non-kafka sources are ignored.
        pg: { type: "postgres", table: "orders" },
      },
      environments: {
        development: {
          sim: {
            init: {
              kafka: {
                // `raw.events` is sim-only; `page-views` duplicates a source.
                topics: ["raw.events", "page-views"],
                catalogs: [
                  {
                    name: "ecom",
                    tables: [
                      { table: "orders", topic: "ecom.orders", columns: {} },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    }
    expect(collectDeclaredKafkaTopics(config)).toEqual([
      "ecom.orders",
      "page-views",
      "raw.events",
    ])
  })

  it("returns an empty list when no kafka topics are declared", () => {
    expect(collectDeclaredKafkaTopics({})).toEqual([])
  })
})

describe("sumOffsetOutput", () => {
  it("sums per-partition end offsets across lines", () => {
    expect(sumOffsetOutput("ecom.orders:0:3\necom.orders:1:2\n")).toBe(5)
  })

  it("ignores lines that are not topic:partition:offset shaped", () => {
    const out = [
      "WARN [AdminClient] Connection to node -1 could not be established",
      "page-views:0:4",
      "",
      "Picked up JAVA_TOOL_OPTIONS:",
    ].join("\n")
    expect(sumOffsetOutput(out)).toBe(4)
  })

  it("handles topics whose names contain colons' worth of segments", () => {
    // The topic itself may contain dots but the last two `:` fields win.
    expect(sumOffsetOutput("cdc.inventory.products:0:12")).toBe(12)
  })

  it("returns 0 for empty output or all-zero offsets", () => {
    expect(sumOffsetOutput("")).toBe(0)
    expect(sumOffsetOutput("t:0:0\nt:1:0")).toBe(0)
  })
})

describe("selectSubjectsForTopics", () => {
  it('returns every subject for "all"', () => {
    expect(selectSubjectsForTopics(subjects, "all")).toHaveLength(
      subjects.length,
    )
  })

  it("filters by exact topic match otherwise", () => {
    const out = selectSubjectsForTopics(subjects, ["ecom.orders", "absent"])
    expect(out.map((s) => s.topic)).toEqual(["ecom.orders"])
  })
})

describe("seedKafkaSampleData", () => {
  it("produces each selected subject's sample rows as JSON lines", async () => {
    const produced: Record<string, string[]> = {}
    const res = await seedKafkaSampleData({
      topics: ["page-views", "ecom.orders"],
      subjects,
      produce: (topic, lines) => {
        produced[topic] = [...lines]
      },
    })
    expect(res.produced).toBe(3)
    expect([...res.seededTopics].sort()).toEqual(["ecom.orders", "page-views"])
    expect(produced["page-views"]).toEqual(['{"a":1}', '{"a":2}'])
  })

  it("skips subjects that have no sample rows without producing", async () => {
    const produce = vi.fn()
    const res = await seedKafkaSampleData({
      topics: ["no-rows"],
      subjects,
      produce,
    })
    expect(produce).not.toHaveBeenCalled()
    expect(res.produced).toBe(0)
    expect(res.seededTopics).toEqual([])
  })

  it("honors shouldSkip (idempotency guard) and records the skip", async () => {
    const produce = vi.fn()
    const res = await seedKafkaSampleData({
      topics: "all",
      subjects,
      shouldSkip: (topic) => topic === "page-views",
      produce,
    })
    expect(res.skipped).toEqual(["page-views"])
    expect(res.seededTopics).toEqual(["ecom.orders"])
    expect(produce).toHaveBeenCalledTimes(1)
  })

  it("registers every selected subject when a register fn is provided", async () => {
    const register = vi.fn()
    const res = await seedKafkaSampleData({
      topics: "all",
      subjects,
      register,
      produce: () => {},
    })
    expect(register).toHaveBeenCalledTimes(subjects.length)
    expect(res.registered).toBe(subjects.length)
  })

  it("is best-effort: a throwing produce is swallowed, not counted", async () => {
    const res = await seedKafkaSampleData({
      topics: ["page-views"],
      subjects,
      produce: () => {
        throw new Error("broker down")
      },
    })
    expect(res.produced).toBe(0)
    expect(res.seededTopics).toEqual([])
  })
})
