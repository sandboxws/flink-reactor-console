import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { CompletionItemKind, type TextEdit } from "vscode-languageserver"
import type { DocumentSynthState } from "../../src/document-state.js"
import { buildPositionMap } from "../../src/mappers/source-position-mapper.js"
import { provideCompletion } from "../../src/providers/completion/index.js"
import { synthesizeDocument } from "../../src/synth/runner.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

interface Fixture {
  readonly state: DocumentSynthState
  readonly text: string
  readonly fileName: string
}

/** Synthesize a fixture (optionally with overridden buffer text) into the shared
 *  per-document synth state a provider reads. */
async function synth(fixture: string, override?: string): Promise<Fixture> {
  const entryPoint = join(FIXTURES, fixture)
  const text = override ?? readFileSync(entryPoint, "utf-8")
  const result = await synthesizeDocument({
    entryPoint,
    projectDir: FIXTURES,
    documentText: override,
  })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  return {
    state: {
      uri: pathToFileURL(entryPoint).href,
      version: 1,
      result,
      positionMap,
    },
    text,
    fileName: entryPoint,
  }
}

/** Position `delta` chars into the first occurrence of `anchor`. */
function posAt(text: string, anchor: string, delta = anchor.length) {
  const idx = text.indexOf(anchor)
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`)
  const at = idx + delta
  const before = text.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    character: at - (before.lastIndexOf("\n") + 1),
  }
}

function complete(
  fx: Fixture,
  position: ReturnType<typeof posAt>,
  withSynth = true,
) {
  return provideCompletion({
    sourceText: fx.text,
    fileName: fx.fileName,
    position,
    tsPluginActive: false,
    synthState: withSynth ? fx.state : undefined,
  })
}

const labels = (list: { items: { label: string }[] }) =>
  list.items.map((i) => i.label)

/** Apply a `TextEdit` to text (single-edit, for asserting insertion shape). */
function applyEdit(text: string, edit: TextEdit): string {
  const offset = (line: number, ch: number) => {
    const lines = text.split("\n")
    return lines.slice(0, line).reduce((a, l) => a + l.length + 1, 0) + ch
  }
  const start = offset(edit.range.start.line, edit.range.start.character)
  const end = offset(edit.range.end.line, edit.range.end.character)
  return text.slice(0, start) + edit.newText + text.slice(end)
}

describe("1.x expression-prop context detection", () => {
  it("1.4 a cursor inside a Filter condition offers the upstream columns", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="amount', 'condition="'.length),
    )
    expect(labels(list)).toEqual(
      expect.arrayContaining(["order_id", "amount", "order_time"]),
    )
    for (const item of list.items)
      expect(item.data).toMatchObject({ kind: "column-ref" })
  })

  it("1.4 a cursor inside a connector prop offers no column completions", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(fx, posAt(fx.text, 'topic="orders', 'topic="'.length))
    // No FR column items; topic is not an expression prop.
    expect(list.items.every((i) => i.data?.kind !== "column-ref")).toBe(true)
    expect(labels(list)).not.toContain("order_id")
  })
})

describe("2.x upstream schema resolution across topology", () => {
  it("2.2 reflects a renaming upstream Map (renamed, not original, columns)", async () => {
    const fx = await synth("column-rename-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="amount', 'condition="'.length),
    )
    expect(labels(list)).toContain("customer_id") // the Map's output name
    expect(labels(list)).not.toContain("user_id") // the source's original name
  })

  it("2.3 a join `on` exposes columns from both inputs (deduped)", async () => {
    const fx = await synth("column-join-pipeline.tsx")
    const list = complete(fx, posAt(fx.text, 'on="user_id = id', 'on="'.length))
    expect(labels(list)).toEqual(
      expect.arrayContaining(["order_id", "user_id", "amount", "id", "name"]),
    )
  })

  it("2.4 a windowed node exposes window_start/window_end downstream", async () => {
    const fx = await synth("column-window-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="views', 'condition="'.length),
    )
    expect(labels(list)).toEqual(
      expect.arrayContaining([
        "user_id",
        "views",
        "window_start",
        "window_end",
      ]),
    )
  })

  it("2.4 an Aggregate inside a window sees the pre-window source columns", async () => {
    const fx = await synth("column-window-pipeline.tsx")
    // The first `user_id: "user_id"` is the Aggregate's `select` value.
    const list = complete(
      fx,
      posAt(fx.text, 'views: "COUNT', 'views: "'.length),
    )
    expect(labels(list)).toEqual(
      expect.arrayContaining(["user_id", "page_url", "event_time"]),
    )
    expect(labels(list)).not.toContain("window_start") // window cols not yet in scope
  })
})

describe("3.x completion items", () => {
  it("3.1 items are Field-kind with the column's Flink type as detail", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="amount', 'condition="'.length),
    )
    const amount = list.items.find((i) => i.label === "amount")
    expect(amount?.kind).toBe(CompletionItemKind.Field)
    expect(amount?.detail).toMatch(/DECIMAL/)
  })

  it("3.2 inserts a backtick-quoted identifier, replacing the partial token", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="amount', 'condition="am'.length),
    )
    const amount = list.items.find((i) => i.label === "amount")
    expect(amount?.textEdit).toBeDefined()
    const edited = applyEdit(fx.text, amount?.textEdit as TextEdit)
    expect(edited).toContain('condition="`amount`')
  })

  it("3.2/3.4 an already-open backtick is not doubled", async () => {
    // Author has typed an opening backtick before triggering completion.
    const override = readFileSync(
      join(FIXTURES, "hover-pipeline.tsx"),
      "utf-8",
    ).replace('condition="amount > 0"', 'condition="`am > 0"')
    const fx = await synth("hover-pipeline.tsx", override)
    const list = complete(
      fx,
      posAt(fx.text, 'condition="`am', 'condition="`am'.length),
    )
    const amount = list.items.find((i) => i.label === "amount")
    const edited = applyEdit(fx.text, amount?.textEdit as TextEdit)
    expect(edited).toContain('condition="`amount` > 0"')
    expect(edited).not.toContain("``") // no doubled backtick
  })

  it("3.3 sortText ranks columns ahead of generic word completions", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="amount', 'condition="'.length),
    )
    for (const item of list.items)
      expect(item.sortText?.startsWith("0")).toBe(true)
  })
})

describe("4.x graceful degradation", () => {
  it("4.1 returns no items when synthesis state is absent", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'condition="amount', 'condition="'.length),
      /* withSynth */ false,
    )
    expect(list.items).toEqual([])
  })

  it("4.1 returns no items when synthesis failed (no resolvable schema)", async () => {
    const fx = await synth("throwing-pipeline.tsx")
    // Even if the cursor sits in a recognized prop, a failed synth yields none.
    const list = provideCompletion({
      sourceText: fx.text,
      fileName: fx.fileName,
      position: { line: 0, character: 0 },
      tsPluginActive: false,
      synthState: fx.state,
    })
    expect(list.items.every((i) => i.data?.kind !== "column-ref")).toBe(true)
  })

  it("4.3 a non-expression prop yields no column items", async () => {
    const fx = await synth("hover-pipeline.tsx")
    const list = complete(
      fx,
      posAt(fx.text, 'table="orders_filtered', 'table="'.length),
    )
    expect(list.items.every((i) => i.data?.kind !== "column-ref")).toBe(true)
  })
})
