import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_KIND_COLOR,
  KIND_COLORS,
  kindColor,
} from "../src/graph/palette"

const HERE = dirname(fileURLToPath(import.meta.url))
// packages/vscode-extension/__tests__ → repo root → src/cli/commands/graph.ts
const CLI_GRAPH = join(
  HERE,
  "..",
  "..",
  "..",
  "src",
  "cli",
  "commands",
  "graph.ts",
)

// The canonical values, as documented in the proposal/design for this change.
const DOCUMENTED: Record<string, string> = {
  Source: "#4CAF50",
  Transform: "#2196F3",
  Join: "#FF9800",
  Window: "#9C27B0",
  Sink: "#F44336",
  Catalog: "#795548",
  RawSQL: "#607D8B",
  UDF: "#009688",
  CEP: "#E91E63",
  Pipeline: "#9E9E9E",
}

describe("graph palette (fr graph parity)", () => {
  it("matches the documented kind→hex values exactly", () => {
    expect(KIND_COLORS).toEqual(DOCUMENTED)
    expect(DEFAULT_KIND_COLOR).toBe("#9E9E9E")
  })

  it("stays in sync with the CLI `fr graph` kindColors source", () => {
    // Pin the webview copy to the actual CLI palette so a change to one side
    // fails here rather than silently diverging.
    const cliSource = readFileSync(CLI_GRAPH, "utf-8")
    for (const [kind, hex] of Object.entries(KIND_COLORS)) {
      expect(
        cliSource.includes(`${kind}: "${hex}"`),
        `CLI graph.ts should map ${kind} → ${hex}`,
      ).toBe(true)
    }
  })

  it("falls back to the default color for unknown kinds", () => {
    expect(kindColor("Source")).toBe("#4CAF50")
    expect(kindColor("MaterializedTable")).toBe(DEFAULT_KIND_COLOR)
    expect(kindColor("definitely-not-a-kind")).toBe(DEFAULT_KIND_COLOR)
  })
})
