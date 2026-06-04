// Diagnostic-driven quick-fixes + the extract-schema refactor
// (component-refactoring, tasks 10.5–10.11).
//
// Real-diagnostic paths run the Tier-1 mapper over a synthesized fixture and
// feed the resulting LSP diagnostics straight into `provideCodeActions` —
// exactly the request shape a client sends. The add-`topic` insertion case is
// driven by a hand-built diagnostic because today's factories throw on a
// missing required prop before the connector validator can report it; the
// builder consumes `Diagnostic.data` either way.

import { describe, expect, it } from "vitest"
import type { Diagnostic } from "vscode-languageserver"
import { mapperContext, toLspDiagnostics } from "../../src/diagnostics/index"
import { provideCodeActions } from "../../src/refactor/code-actions"
import { newFindings } from "../../src/refactor/parity"
import { applyAndResynthesize, type Loaded, load, posAt } from "./load"

/** The fixture's published LSP diagnostics — what a client would hold. */
function publishedDiagnostics(loaded: Loaded): Diagnostic[] {
  return toLspDiagnostics(
    loaded.state.result,
    mapperContext(loaded.state.positionMap, loaded.text, loaded.uri),
  )
}

function actionsFor(
  loaded: Loaded,
  diagnostics: Diagnostic[],
  at?: { line: number; character: number },
) {
  const position = at ?? { line: 0, character: 0 }
  return provideCodeActions({
    state: loaded.state,
    sourceText: loaded.text,
    uri: loaded.uri,
    range: { start: position, end: position },
    diagnostics,
    documentVersion: 1,
  })
}

describe("add-missing-prop quick-fix", () => {
  // 10.5 — the Debezium conditional prop, end-to-end from a real diagnostic.
  it("adds schemaRegistryUrl for a debezium-avro source", async () => {
    const f = await load("connector-missing-prop-pipeline.tsx")
    const diagnostics = publishedDiagnostics(f).filter((d) =>
      String(d.code).startsWith("FR-CONN-"),
    )
    expect(diagnostics.length).toBeGreaterThan(0)

    const actions = actionsFor(f, diagnostics)
    const fix = actions.find((a) => a.title.includes("schemaRegistryUrl"))
    expect(fix).toBeDefined()
    expect(fix?.title).toContain("Debezium")
    if (!fix?.edit) return

    const { text, result } = await applyAndResynthesize(f, fix.edit)
    expect(text).toContain('schemaRegistryUrl=""')
    expect(result.ok).toBe(true)
    // The originating connector finding is gone, nothing new appeared.
    expect(
      result.diagnostics.filter((d) => d.category === "connector"),
    ).toEqual([])
    expect(newFindings(f.state.result, result)).toEqual([])
  })

  // 10.5 — generic insertion mechanics for a required prop named in `data`.
  it("inserts a placeholder prop named in data.missingProps", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const sink = f.state.result.nodes.find((n) => n.component === "GenericSink")
    expect(sink).toBeDefined()
    if (!sink) return
    const range = f.state.positionMap.map.get(sink.id)
    if (!range) throw new Error("sink not mapped")
    const diagnostic: Diagnostic = {
      range: { start: range.start, end: range.end },
      message: "missing required property `topic`",
      code: "FR-CONN-001",
      source: "flink-reactor",
      data: {
        nodeId: sink.id,
        component: "GenericSink",
        missingProps: ["topic"],
      },
    }
    const actions = actionsFor(f, [diagnostic])
    const fix = actions.find((a) => a.title.includes("'topic'"))
    expect(fix?.edit?.changes?.[f.uri]).toBeDefined()
    const edit = fix?.edit?.changes?.[f.uri]?.[0]
    expect(edit?.newText).toBe(' topic=""')
  })

  // 10.10 — a spread-props element cannot take a literal attribute.
  it("offers nothing when the element has spread props", async () => {
    const f = await load("refactor-safety-pipeline.tsx")
    const source = f.state.result.nodes.find(
      (n) => n.component === "KafkaSource",
    )
    if (!source) throw new Error("source missing")
    const range = f.state.positionMap.map.get(source.id)
    if (!range) throw new Error("source not mapped")
    const diagnostic: Diagnostic = {
      range: { start: range.start, end: range.end },
      message: "missing required property `format`",
      code: "FR-CONN-001",
      source: "flink-reactor",
      data: {
        nodeId: source.id,
        component: "KafkaSource",
        missingProps: ["format"],
      },
    }
    const actions = actionsFor(f, [diagnostic]).filter(
      (a) => a.kind === "quickfix",
    )
    expect(actions).toEqual([])
  })
})

describe("replace-with-candidate quick-fix", () => {
  // 10.6 — `` `amont` `` → `` `amount` `` from the real schema diagnostic.
  it("replaces a misspelled column with the did-you-mean candidate", async () => {
    const f = await load("schema-typo-pipeline.tsx")
    const diagnostics = publishedDiagnostics(f).filter((d) =>
      String(d.code).startsWith("FR-SCHEMA-"),
    )
    expect(diagnostics.length).toBeGreaterThan(0)

    const actions = actionsFor(f, diagnostics)
    const fix = actions.find((a) => a.title.includes("`amont`"))
    expect(fix).toBeDefined()
    expect(fix?.title).toContain("`amount`")
    if (!fix?.edit) return

    const { text, result } = await applyAndResynthesize(f, fix.edit)
    // The condition's token is replaced; the rest of the expression intact
    // (the fixture's prose comment still mentions `amont` — only the
    // implicated token inside the prop is edited).
    expect(text).toContain('condition="`amount` > 100"')
    expect(text).not.toContain('condition="`amont` > 100"')
    expect(result.ok).toBe(true)
    expect(result.diagnostics.filter((d) => d.category === "schema")).toEqual(
      [],
    )
    expect(newFindings(f.state.result, result)).toEqual([])
  })

  // 10.6 — `bootstrapServer` → `bootstrapServers`, preserving the value.
  it("renames a misspelled connector prop and keeps its value", async () => {
    const f = await load("refactor-prop-typo-pipeline.tsx")
    const diagnostics = publishedDiagnostics(f).filter((d) =>
      String(d.code).startsWith("FR-CONN-"),
    )
    expect(diagnostics.length).toBeGreaterThan(0)

    const actions = actionsFor(f, diagnostics)
    // Both the add-missing and the rename fixes are offered; take the rename.
    const fix = actions.find((a) => a.title.startsWith("Rename prop"))
    expect(fix?.title).toBe(
      "Rename prop 'bootstrapServer' to 'bootstrapServers'",
    )
    if (!fix?.edit) return

    const { text, result } = await applyAndResynthesize(f, fix.edit)
    expect(text).toContain('bootstrapServers="kafka:9092"')
    expect(result.ok).toBe(true)
    expect(
      result.diagnostics.filter((d) => d.category === "connector"),
    ).toEqual([])
  })
})

describe("wrap-window quick-fix", () => {
  // 10.7 — the unbounded Aggregate is wrapped in a TumbleWindow with the
  // watermark column as the time attribute; props/grouping preserved.
  it("wraps the window-less Aggregate, clearing the changelog finding", async () => {
    const f = await load("refactor-aggregate-pipeline.tsx")
    const diagnostics = publishedDiagnostics(f).filter((d) =>
      String(d.code).startsWith("FR-CDC-"),
    )
    expect(diagnostics.length).toBeGreaterThan(0)

    const actions = actionsFor(f, diagnostics)
    const tumble = actions.find((a) => a.title.includes("<TumbleWindow>"))
    expect(tumble).toBeDefined()
    expect(tumble?.isPreferred).toBe(true)
    // Alternate window kinds are offered too.
    expect(actions.some((a) => a.title.includes("<SlideWindow>"))).toBe(true)
    expect(actions.some((a) => a.title.includes("<SessionWindow>"))).toBe(true)
    if (!tumble?.edit) return

    const { text, result } = await applyAndResynthesize(f, tumble.edit)
    // Wrapper uses the source's watermark column as the time attribute.
    expect(text).toContain('<TumbleWindow size="1 minute" on="order_time">')
    expect(text).toContain("</TumbleWindow>")
    // The aggregate's props and grouping are preserved inside the wrapper.
    expect(text).toContain('groupBy={["order_id"]}')
    expect(text).toContain('total: "SUM(amount)"')
    // The window component is imported.
    expect(text).toMatch(
      /import \{[^}]*TumbleWindow[^}]*\} from "@flink-reactor\/dsl"/s,
    )
    expect(result.ok).toBe(true)
    expect(
      result.diagnostics.filter((d) => d.category === "changelog"),
    ).toEqual([])
    expect(newFindings(f.state.result, result)).toEqual([])
  })
})

describe("swap-sink quick-fix", () => {
  // 10.8 — the append-only sink fed by a retract stream is replaced with a
  // changelog-compatible sink; sink-specific props are scaffolded.
  it("swaps the FileSystemSink for an upsert JdbcSink", async () => {
    const f = await load("refactor-aggregate-pipeline.tsx")
    const diagnostics = publishedDiagnostics(f).filter((d) =>
      String(d.code).startsWith("FR-CDC-"),
    )
    const actions = actionsFor(f, diagnostics)
    const swap = actions.find((a) =>
      a.title.includes("Replace FileSystemSink with JdbcSink"),
    )
    expect(swap).toBeDefined()
    expect(swap?.isPreferred).toBe(true)
    // Other compatible sinks are offered as alternates.
    expect(actions.some((a) => a.title.includes("with PaimonSink"))).toBe(true)
    expect(actions.some((a) => a.title.includes("with IcebergSink"))).toBe(true)
    if (!swap?.edit) return

    const { text, result } = await applyAndResynthesize(f, swap.edit)
    // The upsert key is scaffolded from what flows into the sink.
    expect(text).toContain(
      '<JdbcSink url="" table="" upsertMode keyFields={["order_id"]} />',
    )
    expect(text).not.toContain("FileSystemSink path=")
    expect(text).toMatch(
      /import \{[^}]*JdbcSink[^}]*\} from "@flink-reactor\/dsl"/s,
    )
    expect(result.ok).toBe(true)
    expect(
      result.diagnostics.filter((d) => d.category === "changelog"),
    ).toEqual([])
    expect(newFindings(f.state.result, result)).toEqual([])
  })
})

describe("extract-inline-schema refactor", () => {
  // 10.9 — one WorkspaceEdit spanning the created module and the pipeline.
  it("extracts the inline schema into schemas/<name>.ts with the import wired", async () => {
    const f = await load("refactor-inline-schema-pipeline.tsx")
    const actions = actionsFor(
      f,
      [],
      posAt(f.text, "schema={Schema({", 10), // cursor on the inline call
    )
    const extract = actions.find((a) => a.kind === "refactor.extract")
    expect(extract).toBeDefined()
    expect(extract?.title).toBe("Extract schema to schemas/payments.ts")
    const changes = extract?.edit?.documentChanges ?? []
    expect(changes.length).toBe(3)

    // CreateFile for the new module…
    const create = changes.find((c) => "kind" in c && c.kind === "create")
    expect(create).toBeDefined()
    const moduleUri = create && "uri" in create ? create.uri : ""
    expect(moduleUri.endsWith("schemas/payments.ts")).toBe(true)

    // …its content (export + DSL imports)…
    const moduleEdit = changes.find(
      (c) => "textDocument" in c && c.textDocument.uri === moduleUri,
    )
    if (!moduleEdit || !("edits" in moduleEdit))
      throw new Error("no module edit")
    const content = moduleEdit.edits[0]?.newText ?? ""
    expect(content).toContain(
      'import { Field, Schema } from "@flink-reactor/dsl"',
    )
    expect(content).toContain("export const PaymentsSchema = Schema({")
    expect(content).toContain("payment_id: Field.BIGINT()")

    // …and the pipeline rewired: import added, inline literal replaced.
    const pipelineEdit = changes.find(
      (c) => "textDocument" in c && c.textDocument.uri === f.uri,
    )
    if (!pipelineEdit || !("edits" in pipelineEdit))
      throw new Error("no pipeline edit")
    const newTexts = pipelineEdit.edits.map((e) => e.newText)
    expect(
      newTexts.some((t) => t.includes("import { PaymentsSchema } from ")),
    ).toBe(true)
    expect(newTexts).toContain("PaymentsSchema")
  })
})

describe("stale-state guard", () => {
  // The dispatcher refuses diagnostic-driven fixes when the held synthesis
  // state trails the document version (a write must never land on moved text).
  it("offers no quick-fixes for a stale document version", async () => {
    const f = await load("schema-typo-pipeline.tsx")
    const diagnostics = publishedDiagnostics(f)
    const actions = provideCodeActions({
      state: f.state,
      sourceText: f.text,
      uri: f.uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      diagnostics,
      documentVersion: 2, // ahead of the held state (version 1)
    })
    expect(actions.filter((a) => a.kind === "quickfix")).toEqual([])
  })
})
