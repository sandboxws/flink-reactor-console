import { describe, expect, it } from "vitest"
import type { SourceDefinition } from "@/core/config.js"
import { defineConfig } from "@/core/config.js"

describe("defineConfig — sources", () => {
  it("accepts a valid sources registry", () => {
    const config = defineConfig({
      sources: {
        orders: { type: "postgres", table: "public.orders" },
        clicks: {
          type: "jdbc",
          table: "analytics.clicks",
          service: "warehouse",
        },
        events: { type: "kafka", topic: "events", format: "avro" },
      },
    })
    expect(Object.keys(config.sources ?? {})).toEqual([
      "orders",
      "clicks",
      "events",
    ])
  })

  it("rejects an invalid source type", () => {
    expect(() =>
      defineConfig({
        sources: {
          bad: { type: "mysql", table: "x" } as unknown as SourceDefinition,
        },
      }),
    ).toThrow(/Invalid source type/)
  })

  it("rejects an invalid source name", () => {
    expect(() =>
      defineConfig({
        sources: { "1bad": { type: "postgres", table: "x" } },
      }),
    ).toThrow(/Invalid source name/)
  })

  it("requires a table for postgres/jdbc sources", () => {
    expect(() =>
      defineConfig({
        sources: {
          orders: { type: "postgres" } as unknown as SourceDefinition,
        },
      }),
    ).toThrow(/requires a 'table'/)
  })

  it("requires a topic for kafka sources", () => {
    expect(() =>
      defineConfig({
        sources: {
          events: { type: "kafka" } as unknown as SourceDefinition,
        },
      }),
    ).toThrow(/requires a 'topic'/)
  })
})
