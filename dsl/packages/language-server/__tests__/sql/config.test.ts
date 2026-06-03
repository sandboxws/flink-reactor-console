import { describe, expect, it } from "vitest"
import {
  DEFAULT_CONFIG,
  parseConfig,
  sqlSemanticTokensEnabled,
} from "../../src/config.js"

describe("flinkReactor.sql.highlighting config", () => {
  it("defaults to semantic+textmate (server emits SQL tokens)", () => {
    expect(DEFAULT_CONFIG.sqlHighlighting).toBe("semantic+textmate")
    expect(sqlSemanticTokensEnabled(DEFAULT_CONFIG)).toBe(true)
  })

  it("reads the VS Code shell's flat `sqlHighlighting` key", () => {
    const config = parseConfig({
      flinkReactor: { sqlHighlighting: "semantic" },
    })
    expect(config.sqlHighlighting).toBe("semantic")
    expect(sqlSemanticTokensEnabled(config)).toBe(true)
  })

  it("reads a nested `sql.highlighting` shape (non-VS-Code client)", () => {
    const config = parseConfig({ sql: { highlighting: "textmate" } })
    expect(config.sqlHighlighting).toBe("textmate")
  })

  it("suppresses server SQL tokens for textmate / off", () => {
    for (const mode of ["textmate", "off"] as const) {
      const config = parseConfig({ flinkReactor: { sqlHighlighting: mode } })
      expect(config.sqlHighlighting).toBe(mode)
      expect(sqlSemanticTokensEnabled(config)).toBe(false)
    }
  })

  it("enables server SQL tokens for semantic / semantic+textmate", () => {
    for (const mode of ["semantic", "semantic+textmate"] as const) {
      const config = parseConfig({ flinkReactor: { sqlHighlighting: mode } })
      expect(sqlSemanticTokensEnabled(config)).toBe(true)
    }
  })

  it("falls back to the prior mode on an unknown value", () => {
    const config = parseConfig({ flinkReactor: { sqlHighlighting: "rainbow" } })
    expect(config.sqlHighlighting).toBe("semantic+textmate")
  })

  it("preserves the mode across an unrelated config change (layered base)", () => {
    const base = parseConfig({ flinkReactor: { sqlHighlighting: "off" } })
    const next = parseConfig({ flinkReactor: { debounce: 100 } }, base)
    expect(next.sqlHighlighting).toBe("off")
  })
})
