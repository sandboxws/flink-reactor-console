import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import type { LocationLink } from "vscode-languageserver"
import type { DocumentSynthState } from "../../src/document-state"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { resolveModulePath } from "../../src/providers/definition/binding"
import { provideDefinition } from "../../src/providers/definition/index"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

interface Loaded {
  readonly uri: string
  readonly text: string
  readonly state: DocumentSynthState
}

/** Synthesize a fixture into the held per-document state definition reads. */
async function load(name: string): Promise<Loaded> {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  return { uri, text, state: { uri, version: 1, result, positionMap } }
}

/** Cursor `delta` characters into the first occurrence of `marker`. */
function posAt(
  text: string,
  marker: string,
  delta = 0,
): { line: number; character: number } {
  const idx = text.indexOf(marker)
  if (idx < 0) throw new Error(`marker not found: ${marker}`)
  const before = text.slice(0, idx + delta).split("\n")
  return {
    line: before.length - 1,
    character: before[before.length - 1].length,
  }
}

function offsetOf(text: string, line: number, character: number): number {
  const lines = text.split("\n")
  let offset = 0
  for (let i = 0; i < line; i++) offset += lines[i].length + 1
  return offset + character
}

/** The source text covered by an LSP range — for asserting the landing spot. */
function textAt(text: string, range: LocationLink["targetRange"]): string {
  return text.slice(
    offsetOf(text, range.start.line, range.start.character),
    offsetOf(text, range.end.line, range.end.character),
  )
}

function def(loaded: Loaded, marker: string, delta = 0): LocationLink[] | null {
  return provideDefinition({
    state: loaded.state,
    sourceText: loaded.text,
    uri: loaded.uri,
    position: posAt(loaded.text, marker, delta),
  })
}

describe("provideDefinition — catalog handle", () => {
  // 2.4 — `<IcebergSink catalog={iceberg.handle} />` resolves to the
  // `IcebergCatalog({…})` that defines the handle.
  it("resolves a catalog prop to the catalog declaration", async () => {
    const f = await load("hover-catalog-pipeline.tsx")
    const result = def(f, "catalog={iceberg.handle}", "catalog={i".length)
    expect(result).not.toBeNull()
    const [hit] = result ?? []
    expect(hit.targetUri).toBe(f.uri)
    expect(textAt(f.text, hit.targetRange)).toContain("IcebergCatalog({")
  })

  // 2.4 — a handle built by a call (no resolvable variable) is not navigable.
  it("returns no result for a computed catalog handle", () => {
    const text = `const sink = <IcebergSink catalog={makeHandle()} />\n`
    const result = provideDefinition({
      state: undefined,
      sourceText: text,
      uri: pathToFileURL(join(FIXTURES, "synthetic.tsx")).href,
      position: posAt(text, "makeHandle", 2),
    })
    expect(result).toBeNull()
  })
})

describe("provideDefinition — column reference", () => {
  // 3.5 — a bare column in a Filter condition resolves to its inline Schema field.
  it("resolves a bare column to the inline Schema field key", async () => {
    const f = await load("def-inline-pipeline.tsx")
    const result = def(f, "amount > 0", 2)
    expect(result).not.toBeNull()
    const [hit] = result ?? []
    expect(hit.targetUri).toBe(f.uri)
    expect(textAt(f.text, hit.targetRange)).toBe("amount")
  })

  // 3.5 — a back-quoted column resolves the same as a bare one.
  it("resolves a back-quoted column", async () => {
    const f = await load("def-inline-pipeline.tsx")
    const result = def(f, "`order_id`", 2)
    expect(result).not.toBeNull()
    expect(textAt(f.text, (result ?? [])[0].targetRange)).toBe("order_id")
  })

  // 3.5 — a column whose schema lives in `schemas/orders.ts` resolves across files.
  it("resolves a column across files into the schema module", async () => {
    const f = await load("def-xfile-pipeline.tsx")
    const result = def(f, "o_orderkey > 0", 2)
    expect(result).not.toBeNull()
    const [hit] = result ?? []
    const modulePath = join(FIXTURES, "schemas", "orders.ts")
    expect(hit.targetUri).toBe(pathToFileURL(modulePath).href)
    const moduleText = readFileSync(modulePath, "utf8")
    expect(textAt(moduleText, hit.targetRange)).toBe("o_orderkey")
  })

  // 3.5 — a cursor on a SQL keyword (not a column) yields no result.
  it("returns no result on a SQL keyword", async () => {
    const f = await load("def-inline-pipeline.tsx")
    expect(def(f, "AND `order_id`", 1)).toBeNull()
  })
})

describe("provideDefinition — component input + qualified column", () => {
  // 4.3 — a Join `left`/`right` input resolves to the bound node's JSX.
  it("resolves Join left/right to the referenced node", async () => {
    const f = await load("def-join-pipeline.tsx")
    const left = def(f, "left={orders}", "left={".length)
    expect(left).not.toBeNull()
    expect(textAt(f.text, (left ?? [])[0].targetRange)).toContain("KafkaSource")

    const right = def(f, "right={payments}", "right={".length)
    expect(right).not.toBeNull()
    expect(textAt(f.text, (right ?? [])[0].targetRange)).toContain(
      "KafkaSource",
    )
  })

  // 3.5 — a qualified `alias.column` resolves to the field in the source the
  // alias is bound to.
  it("resolves a qualified column to the aliased source's field", async () => {
    const f = await load("def-join-pipeline.tsx")
    const result = def(f, "orders.total", "orders.".length)
    expect(result).not.toBeNull()
    expect(textAt(f.text, (result ?? [])[0].targetRange)).toBe("total")
  })
})

describe("resolveModulePath", () => {
  // The `@/` project alias resolves against the project root and `src/`.
  it("resolves the @/ alias to a project file", () => {
    const resolved = resolveModulePath(
      "@/schemas/orders",
      join(FIXTURES, "def-xfile-pipeline.tsx"),
      FIXTURES,
    )
    expect(resolved).toBe(join(FIXTURES, "schemas", "orders.ts"))
  })

  it("returns undefined for a bare module specifier", () => {
    expect(
      resolveModulePath(
        "@flink-reactor/dsl",
        join(FIXTURES, "x.tsx"),
        FIXTURES,
      ),
    ).toBeUndefined()
  })
})
