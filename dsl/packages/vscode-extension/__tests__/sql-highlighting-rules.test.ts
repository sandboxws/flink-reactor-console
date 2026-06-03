import { describe, expect, it } from "vitest"
import {
  FR_SQL_MARKER_SCOPE,
  nextTextMateRules,
  stringColorFor,
  type TextMateRule,
  textMateLayerActive,
} from "../src/sql/highlighting-rules"

const frRule = (rules: TextMateRule[] | null): TextMateRule | undefined =>
  (rules ?? []).find((r) => r.scope === FR_SQL_MARKER_SCOPE)

describe("textMateLayerActive", () => {
  it("keeps the grammar layer for semantic+textmate and textmate", () => {
    expect(textMateLayerActive("semantic+textmate")).toBe(true)
    expect(textMateLayerActive("textmate")).toBe(true)
  })
  it("excludes the grammar layer for semantic and off", () => {
    expect(textMateLayerActive("semantic")).toBe(false)
    expect(textMateLayerActive("off")).toBe(false)
  })
})

describe("nextTextMateRules", () => {
  it("writes nothing on a fresh install (default mode, no FR rule needed)", () => {
    expect(nextTextMateRules([], "semantic+textmate", false)).toBeNull()
  })

  it("neutralizes the FR marker scope when the grammar layer is off", () => {
    for (const mode of ["semantic", "off"]) {
      const rules = nextTextMateRules([], mode, false)
      const rule = frRule(rules)
      expect(rule).toBeDefined()
      expect(rule?.settings.foreground).toBe(stringColorFor(false))
    }
  })

  it("uses a theme-appropriate neutralization color", () => {
    expect(
      frRule(nextTextMateRules([], "off", true))?.settings.foreground,
    ).toBe(stringColorFor(true))
    expect(
      frRule(nextTextMateRules([], "off", false))?.settings.foreground,
    ).toBe(stringColorFor(false))
    expect(stringColorFor(true)).not.toBe(stringColorFor(false))
  })

  it("removes a prior FR rule when switching back to a textmate mode", () => {
    const existing: TextMateRule[] = [
      { scope: FR_SQL_MARKER_SCOPE, settings: { foreground: "#ce9178" } },
    ]
    expect(nextTextMateRules(existing, "semantic+textmate", false)).toEqual([])
    expect(nextTextMateRules(existing, "textmate", false)).toEqual([])
  })

  it("preserves the user's own unrelated rules", () => {
    const mine: TextMateRule = {
      scope: "comment",
      settings: { foreground: "#888888" },
    }
    const rules = nextTextMateRules([mine], "off", false)
    expect(rules).toContainEqual(mine)
    expect(frRule(rules)).toBeDefined()
    // And toggling back leaves only the user's rule.
    expect(
      nextTextMateRules(
        [mine, frRule(rules) as TextMateRule],
        "textmate",
        false,
      ),
    ).toEqual([mine])
  })

  it("returns null (no write) when already in the desired state", () => {
    // off, with the FR rule already present at the right color → no change.
    const present: TextMateRule[] = [
      {
        scope: FR_SQL_MARKER_SCOPE,
        settings: { foreground: stringColorFor(false) },
      },
    ]
    expect(nextTextMateRules(present, "off", false)).toBeNull()
    // textmate, with no FR rule → already clean → no change.
    expect(nextTextMateRules([], "textmate", false)).toBeNull()
  })
})
