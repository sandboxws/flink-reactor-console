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

describe("synthesis timeout config", () => {
  it("defaults to a warm timeout with a generous cold-start boot grace", () => {
    expect(DEFAULT_CONFIG.timeoutMs).toBe(8000)
    expect(DEFAULT_CONFIG.bootGraceMs).toBe(20000)
    // The first (cold) synthesis must out-budget a warm one — it pays worker
    // boot + the first DSL import.
    expect(DEFAULT_CONFIG.bootGraceMs).toBeGreaterThan(DEFAULT_CONFIG.timeoutMs)
  })

  it("reads `timeout` and `bootGraceMs` overrides from client settings", () => {
    const config = parseConfig({
      flinkReactor: { timeout: 3000, bootGraceMs: 12000 },
    })
    expect(config.timeoutMs).toBe(3000)
    expect(config.bootGraceMs).toBe(12000)
  })
})
