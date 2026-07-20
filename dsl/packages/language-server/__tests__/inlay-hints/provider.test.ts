import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { InlayHint, InlayHintLabelPart } from "vscode-languageserver"
import { DEFAULT_INLAY_HINTS, type InlayHintsConfig } from "../../src/config"
import type { DocumentSynthState } from "../../src/document-state"
import { provideInlayHints } from "../../src/inlay-hints/provider"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

async function load(
  name: string,
): Promise<{ text: string; state: DocumentSynthState }> {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  return { text, state: { uri, version: 1, result, positionMap } }
}

/** The whole document as the requested range. */
const FULL_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 10_000, character: 0 },
}

const hintsFor = (
  state: DocumentSynthState | undefined,
  config: InlayHintsConfig = DEFAULT_INLAY_HINTS,
  documentVersion = 1,
): InlayHint[] =>
  provideInlayHints({ state, documentVersion, range: FULL_RANGE, config })

/** Flatten a hint's label parts into one readable string. */
const labelOf = (hint: InlayHint): string =>
  (hint.label as InlayHintLabelPart[]).map((p) => p.value).join("")

/** The hint anchored at `nodeId`'s opening-tag end (via the position map —
 *  robust to multi-line opening tags, whose anchor sits on the `/>` line). */
const hintFor = (
  hints: InlayHint[],
  state: DocumentSynthState,
  nodeId: string,
): InlayHint | undefined => {
  const range = state.positionMap.map.get(nodeId)
  if (!range) return undefined
  return hints.find(
    (h) =>
      h.position.line === range.end.line &&
      h.position.character === range.end.character,
  )
}

/** First node id of a given component in the synthesized tree. */
const idOf = (state: DocumentSynthState, component: string): string => {
  const node = state.result.nodes.find((n) => n.component === component)
  if (!node) throw new Error(`no ${component} in synthesized nodes`)
  return node.id
}

describe("provideInlayHints over inlay-pipeline.tsx", () => {
  let text: string
  let state: DocumentSynthState
  beforeAll(async () => {
    ;({ text, state } = await load("inlay-pipeline.tsx"))
    expect(state.result.ok).toBe(true)
  })

  it("3.4 a source yields schema + changelog + parallelism parts", () => {
    const hint = hintFor(hintsFor(state), state, "orders")
    expect(hint).toBeDefined()
    expect(labelOf(hint as InlayHint)).toBe("4 cols · append · p=4")
  })

  it("3.4 a window node adds the injected time-column part", () => {
    const hint = hintFor(hintsFor(state), state, idOf(state, "TumbleWindow"))
    expect(labelOf(hint as InlayHint)).toBe(
      "4 cols · +window_start, +window_end · append · p=4",
    )
  })

  it("3.4 a join node adds the merged-count part", () => {
    const hint = hintFor(hintsFor(state), state, idOf(state, "Join"))
    expect(labelOf(hint as InlayHint)).toBe("6 cols · → 6 cols · append · p=4")
  })

  it("3.3 the schema part's tooltip carries the full column | TYPE schema", () => {
    const hint = hintFor(hintsFor(state), state, "orders")
    const parts = hint?.label as InlayHintLabelPart[]
    const tooltip = parts[0].tooltip
    const value = typeof tooltip === "object" ? tooltip.value : tooltip
    expect(value).toContain("| `order_id` | `BIGINT` |")
    expect(value).toContain("| `order_time` | `TIMESTAMP(3)` |")
  })

  it("3.1 hints anchor at the node's opening-tag end", () => {
    const hint = hintFor(hintsFor(state), state, idOf(state, "Filter"))
    const line = text.split("\n")[hint?.position.line ?? 0]
    expect(line).toContain("<Filter")
    expect(hint?.position.character).toBe(line.trimEnd().length)
  })

  it("3.1 hints are scoped to the requested range", () => {
    const joinLine = text.slice(0, text.indexOf("<Join")).split("\n").length - 1
    const hints = provideInlayHints({
      state,
      documentVersion: 1,
      range: {
        start: { line: joinLine, character: 0 },
        end: { line: joinLine, character: 200 },
      },
      config: DEFAULT_INLAY_HINTS,
    })
    expect(hints).toHaveLength(1)
    expect(labelOf(hints[0])).toContain("→ 6 cols")
  })

  it("the Pipeline container and the catalog get no hint", () => {
    const hints = hintsFor(state)
    expect(hintFor(hints, state, idOf(state, "Pipeline"))).toBeUndefined()
    expect(hintFor(hints, state, idOf(state, "IcebergCatalog"))).toBeUndefined()
  })

  // ── 4.x settings gating ─────────────────────────────────────────────

  it("4.4 master toggle off returns no hints", () => {
    expect(hintsFor(state, { ...DEFAULT_INLAY_HINTS, enabled: false })).toEqual(
      [],
    )
  })

  it("4.4 only-changelog yields changelog-only hints", () => {
    const hints = hintsFor(state, {
      enabled: true,
      schema: "off",
      changelogMode: true,
      parallelism: false,
      windowColumns: false,
      joinColumns: false,
    })
    const source = hintFor(hints, state, "orders")
    expect(labelOf(source as InlayHint)).toBe("append")
  })

  it("4.4 schema=count vs schema=compact render the expected schema part", () => {
    const count = hintFor(
      hintsFor(state, { ...DEFAULT_INLAY_HINTS, schema: "count" }),
      state,
      "users",
    )
    expect(labelOf(count as InlayHint)).toContain("2 cols")
    const compact = hintFor(
      hintsFor(state, { ...DEFAULT_INLAY_HINTS, schema: "compact" }),
      state,
      "users",
    )
    expect(labelOf(compact as InlayHint)).toContain("[id, name]")
  })

  it("windowColumns off suppresses only the window part", () => {
    const hints = hintsFor(state, {
      ...DEFAULT_INLAY_HINTS,
      windowColumns: false,
    })
    const window = hintFor(hints, state, idOf(state, "TumbleWindow"))
    expect(labelOf(window as InlayHint)).toBe("4 cols · append · p=4")
  })

  // ── 6.x graceful absence ────────────────────────────────────────────

  it("6.1/6.3 synthesis trailing the document version returns empty", () => {
    expect(hintsFor(state, DEFAULT_INLAY_HINTS, 2)).toEqual([])
    expect(hintsFor(undefined)).toEqual([])
  })

  it("6.1 a failed synthesis returns empty, never throws", async () => {
    const { state: failed } = await load("throwing-pipeline.tsx")
    expect(failed.result.ok).toBe(false)
    expect(hintsFor(failed)).toEqual([])
  })
})

describe("6.2/6.3 node missing from the position map", () => {
  it("skips the unmapped node while annotating resolvable siblings", async () => {
    // hover-catalog-pipeline aliases its catalog factory, so the catalog node
    // consumes an id-counter slot the predictor never sees: the counter-id
    // IcebergSink goes unmapped while the name-derived KafkaSource stays
    // mapped.
    const { state } = await load("hover-catalog-pipeline.tsx")
    const sinkId = idOf(state, "IcebergSink")
    expect(state.positionMap.mismatch?.unmappedNodeIds).toContain(sinkId)
    const hints = hintsFor(state)
    expect(hintFor(hints, state, idOf(state, "KafkaSource"))).toBeDefined()
    expect(hintFor(hints, state, sinkId)).toBeUndefined()
    expect(hints.length).toBeGreaterThan(0)
  })
})
