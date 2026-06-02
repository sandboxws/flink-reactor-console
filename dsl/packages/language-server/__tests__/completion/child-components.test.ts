import { describe, expect, it } from "vitest"
import { childComponentCompletions } from "../../src/providers/completion/child-components.js"

const labels = (parent: string) =>
  childComponentCompletions(parent).map((i) => i.label)

describe("childComponentCompletions", () => {
  it("offers valid children inside Pipeline and excludes non-children", () => {
    const items = labels("Pipeline")
    // Sources, sinks, transforms, windows, joins are valid children.
    expect(items).toEqual(
      expect.arrayContaining([
        "KafkaSource",
        "Filter",
        "JdbcSink",
        "TumbleWindow",
        "Join",
      ]),
    )
    // Dot-notation sub-components are NOT valid directly under Pipeline.
    expect(items).not.toContain("Route.Branch")
    expect(items).not.toContain("Query.Select")
  })

  it("offers Route.Branch / Route.Default only inside a Route", () => {
    expect(labels("Route")).toEqual(
      expect.arrayContaining(["Route.Branch", "Route.Default"]),
    )
    // …and not under Pipeline.
    expect(labels("Pipeline")).not.toContain("Route.Branch")
  })

  it("pre-fills required props as snippet tab stops", () => {
    const kafka = childComponentCompletions("Pipeline").find(
      (i) => i.label === "KafkaSource",
    )
    // KafkaSource requires `schema` and `topic` → both appear as tab stops.
    expect(kafka?.insertText).toContain("topic=")
    expect(kafka?.insertText).toContain("schema=")
    expect(kafka?.insertText).toMatch(/\$\d/) // has at least one tab stop
    expect(kafka?.insertTextFormat).toBe(2 /* Snippet */)
  })

  it("returns nothing for an unknown parent (defers)", () => {
    expect(childComponentCompletions("NotAComponent")).toEqual([])
  })
})
