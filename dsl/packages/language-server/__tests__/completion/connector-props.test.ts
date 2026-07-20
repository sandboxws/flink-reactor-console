import { describe, expect, it } from "vitest"
import { connectorPropCompletions } from "../../src/providers/completion/connector-props.js"

describe("connectorPropCompletions", () => {
  it("offers KafkaSource props with required ones ranked first", () => {
    const items = connectorPropCompletions("KafkaSource", [])
    const labels = items.map((i) => i.label)
    expect(labels).toEqual(
      expect.arrayContaining(["topic", "bootstrapServers", "format", "schema"]),
    )

    // Required props (topic, schema) carry a sortText that orders before optional.
    const topic = items.find((i) => i.label === "topic")
    const bootstrap = items.find((i) => i.label === "bootstrapServers")
    expect(topic?.detail).toContain("required")
    expect(String(topic?.sortText) < String(bootstrap?.sortText)).toBe(true)
  })

  it("excludes props already present on the element", () => {
    const labels = connectorPropCompletions("KafkaSource", [
      "topic",
      "format",
    ]).map((i) => i.label)
    expect(labels).not.toContain("topic")
    expect(labels).not.toContain("format")
    expect(labels).toContain("bootstrapServers")
  })

  it("draws documentation from JSDoc when present", () => {
    const name = connectorPropCompletions("KafkaSource", []).find(
      (i) => i.label === "name",
    )
    expect(name?.documentation).toBeDefined()
  })

  it("returns nothing for a non-connector component", () => {
    expect(connectorPropCompletions("NotAComponent", [])).toEqual([])
  })
})
