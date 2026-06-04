import { describe, expect, it } from "vitest"
import {
  formatChangelogPart,
  formatJoinPart,
  formatParallelismPart,
  formatSchemaPart,
  formatWindowPart,
} from "../../src/inlay-hints/format"

const NARROW = [
  { name: "user_id", type: "BIGINT" },
  { name: "amount", type: "DECIMAL(10, 2)" },
  { name: "ts", type: "TIMESTAMP(3)" },
]

// 12 columns — wide enough that `compact` must fall back to a count.
const WIDE = Array.from({ length: 12 }, (_, i) => ({
  name: `column_${i + 1}`,
  type: "STRING",
}))

describe("formatSchemaPart", () => {
  it("2.1 count mode renders the column count", () => {
    expect(formatSchemaPart(NARROW, "count")).toMatchSnapshot()
  })

  it("2.1 compact mode lists column names inline", () => {
    expect(formatSchemaPart(NARROW, "compact")).toMatchSnapshot()
  })

  it("2.5 compact mode truncates a wide schema to a count with ellipsis", () => {
    const part = formatSchemaPart(WIDE, "compact")
    expect(part?.label).toBe("12 cols …")
    expect(part).toMatchSnapshot()
  })

  it("2.5 the full-schema tooltip is attached in every mode", () => {
    for (const mode of ["count", "compact"] as const) {
      const part = formatSchemaPart(NARROW, mode)
      expect(part?.tooltip).toContain("| `user_id` | `BIGINT` |")
      expect(part?.tooltip).toContain("| `ts` | `TIMESTAMP(3)` |")
    }
  })

  it("2.1 off mode omits the part; an empty schema yields none", () => {
    expect(formatSchemaPart(NARROW, "off")).toBeUndefined()
    expect(formatSchemaPart([], "count")).toBeUndefined()
  })
})

describe("formatChangelogPart", () => {
  it("2.2 renders the DSL's append-only as the compact append badge", () => {
    expect(formatChangelogPart("append-only")).toMatchSnapshot()
  })

  it("2.2 retract and upsert pass through", () => {
    expect(formatChangelogPart("retract").label).toBe("retract")
    expect(formatChangelogPart("upsert").label).toBe("upsert")
  })
})

describe("formatParallelismPart", () => {
  it("2.3 renders p=<n> with the cascade level in the tooltip", () => {
    expect(formatParallelismPart({ value: 4, level: "prop" })).toMatchSnapshot()
  })

  it("2.3 names the default cascade level", () => {
    const part = formatParallelismPart({ value: 1, level: "default" })
    expect(part.label).toBe("p=1")
    expect(part.tooltip).toContain("built-in default")
  })
})

describe("formatWindowPart / formatJoinPart", () => {
  it("2.4 window part lists the injected time columns", () => {
    expect(
      formatWindowPart([
        { name: "window_start", type: "TIMESTAMP(3)" },
        { name: "window_end", type: "TIMESTAMP(3)" },
      ]),
    ).toMatchSnapshot()
  })

  it("2.4 window part is omitted when no columns were injected", () => {
    expect(formatWindowPart([])).toBeUndefined()
  })

  it("2.4 join part renders the merged column count", () => {
    expect(formatJoinPart(6)).toMatchSnapshot()
  })

  it("singular column counts read naturally", () => {
    expect(formatJoinPart(1).label).toBe("→ 1 col")
  })
})
