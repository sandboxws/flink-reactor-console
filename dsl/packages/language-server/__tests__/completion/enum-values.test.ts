import { describe, expect, it } from "vitest"
import { enumValueCompletions } from "../../src/providers/completion/enum-values.js"

describe("enumValueCompletions", () => {
  it("offers exactly the KafkaSource format literals", () => {
    const labels = enumValueCompletions("KafkaSource", "format").map(
      (i) => i.label,
    )
    expect(labels).toEqual(
      expect.arrayContaining([
        "json",
        "avro",
        "debezium-json",
        "debezium-avro",
        "canal-json",
        "maxwell-json",
      ]),
    )
    // Bare literal insert text (cursor sits inside the quotes).
    const json = enumValueCompletions("KafkaSource", "format").find(
      (i) => i.label === "json",
    )
    expect(json?.insertText).toBe("json")
  })

  it("offers the startupMode literals", () => {
    const labels = enumValueCompletions("KafkaSource", "startupMode").map(
      (i) => i.label,
    )
    expect(labels).toEqual(
      expect.arrayContaining([
        "latest-offset",
        "earliest-offset",
        "group-offsets",
        "timestamp",
      ]),
    )
  })

  it("covers an Iceberg/Paimon enum prop", () => {
    const labels = enumValueCompletions("PaimonSink", "mergeEngine").map(
      (i) => i.label,
    )
    expect(labels).toEqual(
      expect.arrayContaining([
        "deduplicate",
        "partial-update",
        "aggregation",
        "first-row",
      ]),
    )
  })

  it("returns nothing for a non-enum prop", () => {
    expect(enumValueCompletions("KafkaSource", "topic")).toEqual([])
    expect(enumValueCompletions("KafkaSource", "nope")).toEqual([])
  })
})
