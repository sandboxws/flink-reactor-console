import { parse as parseJsonc } from "jsonc-parser"
import { describe, expect, it } from "vitest"
import {
  computeTsconfigEdits,
  JSX,
  JSX_IMPORT_SOURCE,
  TS_PLUGIN_NAME,
} from "../src/config/tsconfig-editor.js"

function pluginNames(text: string): string[] {
  const co = parseJsonc(text)?.compilerOptions
  return (co?.plugins ?? []).map((p: { name?: string }) => p.name)
}

describe("computeTsconfigEdits", () => {
  it("adds the plugin, jsxImportSource, and jsx to a bare config", () => {
    const input = `{
  "compilerOptions": {
    "strict": true
  }
}
`
    const { newText, changed, unparseable } = computeTsconfigEdits(input)
    expect(changed).toBe(true)
    expect(unparseable).toBe(false)
    const co = parseJsonc(newText).compilerOptions
    expect(pluginNames(newText)).toContain(TS_PLUGIN_NAME)
    expect(co.jsxImportSource).toBe(JSX_IMPORT_SOURCE)
    expect(co.jsx).toBe(JSX)
    expect(co.strict).toBe(true)
  })

  it("is a no-op when already fully configured", () => {
    const input = `{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@flink-reactor/dsl",
    "plugins": [{ "name": "@flink-reactor/ts-plugin" }]
  }
}
`
    const { newText, changed } = computeTsconfigEdits(input)
    expect(changed).toBe(false)
    expect(newText).toBe(input)
  })

  it("preserves comments and trailing commas", () => {
    const input = `{
  // FlinkReactor project config
  "compilerOptions": {
    "strict": true, // keep me
  }
}
`
    const { newText } = computeTsconfigEdits(input)
    expect(newText).toContain("// FlinkReactor project config")
    expect(newText).toContain("// keep me")
    expect(pluginNames(newText)).toContain(TS_PLUGIN_NAME)
  })

  it("never modifies compilerOptions.paths", () => {
    const input = `{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`
    const { newText } = computeTsconfigEdits(input)
    const paths = parseJsonc(newText).compilerOptions.paths
    expect(paths).toEqual({ "@/*": ["./src/*"] })
  })

  it("appends to an existing plugins array without dropping entries", () => {
    const input = `{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@flink-reactor/dsl",
    "plugins": [{ "name": "some-other-plugin" }]
  }
}
`
    const { newText, changed } = computeTsconfigEdits(input)
    expect(changed).toBe(true)
    expect(pluginNames(newText)).toEqual(["some-other-plugin", TS_PLUGIN_NAME])
  })

  it("reports unparseable input without changing it", () => {
    const input = "{ this is not json"
    const { newText, changed, unparseable } = computeTsconfigEdits(input)
    expect(unparseable).toBe(true)
    expect(changed).toBe(false)
    expect(newText).toBe(input)
  })
})
