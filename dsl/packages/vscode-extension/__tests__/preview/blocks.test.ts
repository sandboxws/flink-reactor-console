import { describe, expect, it } from "vitest"
import {
  blockMatches,
  buildBlocks,
  hitTest,
  noSqlMessage,
  segment,
} from "../../src/preview/blocks"
import type { SynthPipeline } from "../../src/preview/protocol"

// Mirrors the real decoded shape of the `dag-linear` fixture: `statements`
// interleaves `--` banners with executable SQL, `statementMeta` is keyed to the
// banner that precedes each statement, `statementOrigins` to the real
// statement, and the INSERT (DML) has no origin but carries contributor spans.
const INSERT =
  "INSERT INTO `sink_out` SELECT * FROM `orders` WHERE amount > 100"
const SINK_SPAN = "INSERT INTO `sink_out`"
const WHERE_SPAN = "WHERE amount > 100"
const whereStart = INSERT.indexOf("WHERE")

const pipeline: SynthPipeline = {
  id: "dag-linear",
  statements: [
    "-- ============",
    "SET 'pipeline.name' = 'dag-linear';",
    "-- ============",
    "CREATE TABLE `orders` ( `order_id` BIGINT )",
    "-- ============",
    "CREATE TABLE `sink_out` ( `order_id` BIGINT )",
    "-- ============",
    INSERT,
  ],
  statementOrigins: [
    [1, { nodeId: "Pipeline_3", component: "Pipeline", kind: "Pipeline" }],
    [3, { nodeId: "orders", component: "KafkaSource", kind: "Source" }],
    [5, { nodeId: "sink_out", component: "GenericSink", kind: "Sink" }],
  ],
  statementContributors: [
    [
      7,
      [
        { offset: 0, length: SINK_SPAN.length, origin: "sink_out" },
        { offset: whereStart, length: WHERE_SPAN.length, origin: "Filter_1" },
      ],
    ],
  ],
  statementMeta: [
    [0, { label: "Pipeline", section: "configuration" }],
    [
      2,
      { label: "Source: orders", section: "sources", component: "KafkaSource" },
    ],
    [
      4,
      { label: "Sink: sink_out", section: "sinks", component: "GenericSink" },
    ],
    [6, { label: "Transformation: sink_out", section: "pipeline" }],
  ],
}

describe("buildBlocks", () => {
  const blocks = buildBlocks(pipeline)

  it("folds banners away, one block per executable statement", () => {
    // 8 raw statements (4 banners + 4 SQL) → 4 titled blocks; no block is a
    // banner.
    expect(blocks).toHaveLength(4)
    expect(blocks.every((b) => !b.sql.trimStart().startsWith("--"))).toBe(true)
  })

  it("lends each banner's label + section to the following statement", () => {
    expect(blocks.map((b) => b.label)).toEqual([
      "Pipeline",
      "Source: orders",
      "Sink: sink_out",
      "Transformation: sink_out",
    ])
    expect(blocks.map((b) => b.section)).toEqual([
      "configuration",
      "sources",
      "sinks",
      "pipeline",
    ])
  })

  it("keeps the raw statement index as stable identity", () => {
    expect(blocks.map((b) => b.index)).toEqual([1, 3, 5, 7])
  })

  it("attaches the whole-statement origin where one exists (DML has none)", () => {
    expect(blocks[1].originNodeId).toBe("orders")
    expect(blocks[2].originNodeId).toBe("sink_out")
    // The INSERT is DML — no single origin, but it carries contributor spans.
    expect(blocks[3].originNodeId).toBeUndefined()
    expect(blocks[3].fragments.map((f) => f.origin)).toEqual([
      "sink_out",
      "Filter_1",
    ])
  })

  it("derives a label from the origin when no banner precedes a statement", () => {
    const noBanner: SynthPipeline = {
      id: "p",
      statements: ["CREATE TABLE `t` ( x INT )"],
      statementOrigins: [
        [0, { nodeId: "t", component: "KafkaSource", kind: "Source" }],
      ],
      statementContributors: [],
      statementMeta: [],
    }
    expect(buildBlocks(noBanner)[0].label).toBe("KafkaSource (t)")
  })
})

describe("segment (byte-offset → span overlay)", () => {
  const insertBlock = buildBlocks(pipeline)[3]

  it("splits SQL at fragment boundaries, attributing each span to its origin", () => {
    const segs = segment(insertBlock.sql, insertBlock.fragments)
    // Reassembling the segments reproduces the exact SQL (no bytes lost/dup'd).
    expect(segs.map((s) => s.text).join("")).toBe(INSERT)
    // The Filter's span carries its origin and slices to the WHERE predicate.
    const filterSeg = segs.find((s) => s.origin === "Filter_1")
    expect(filterSeg?.text).toBe(WHERE_SPAN)
    const sinkSeg = segs.find((s) => s.origin === "sink_out")
    expect(sinkSeg?.text).toBe(SINK_SPAN)
    // The gap between them (the SELECT) is an un-attributed plain segment.
    expect(segs.some((s) => !s.origin && s.text.includes("SELECT"))).toBe(true)
  })

  it("returns a single plain segment when there are no fragments", () => {
    expect(segment("SELECT 1", [])).toEqual([{ text: "SELECT 1" }])
    expect(segment("", [])).toEqual([])
  })

  it("clamps out-of-range fragment offsets to the text length", () => {
    const segs = segment("abc", [{ offset: 1, length: 100, origin: "n" }])
    expect(segs.map((s) => s.text).join("")).toBe("abc")
    expect(segs.find((s) => s.origin === "n")?.text).toBe("bc")
  })
})

describe("hitTest (SQL→DSL)", () => {
  const blocks = buildBlocks(pipeline)

  it("returns the fragment origin under the offset", () => {
    // A caret inside the WHERE predicate resolves to the Filter.
    expect(hitTest(blocks[3], whereStart + 2)).toBe("Filter_1")
    // A caret inside the leading INSERT span resolves to the sink.
    expect(hitTest(blocks[3], 3)).toBe("sink_out")
  })

  it("falls back to the whole-statement origin off any fragment", () => {
    // The CREATE TABLE has no sub-fragments — any offset → the source node.
    expect(hitTest(blocks[1], 5)).toBe("orders")
  })

  it("returns undefined for a no-origin statement gap (no selection, no error)", () => {
    // Inside the INSERT's SELECT gap there is no fragment and the statement has
    // no single origin → nothing to select.
    const selectOffset = INSERT.indexOf("SELECT") + 1
    expect(hitTest(blocks[3], selectOffset)).toBeUndefined()
  })
})

describe("blockMatches (DSL→SQL)", () => {
  const blocks = buildBlocks(pipeline)

  it("matches the whole statement for its producing node", () => {
    expect(blockMatches(blocks[1], "orders")).toEqual({
      whole: true,
      spans: [],
    })
  })

  it("matches only the contributed spans for a sub-statement node", () => {
    const m = blockMatches(blocks[3], "Filter_1")
    expect(m.whole).toBe(false)
    expect(m.spans).toHaveLength(1)
    expect(m.spans[0].origin).toBe("Filter_1")
  })

  it("matches nothing for an unrelated node", () => {
    expect(blockMatches(blocks[3], "orders")).toEqual({
      whole: false,
      spans: [],
    })
  })
})

// A Flink CDC Pipeline Connector pipeline (PostgresCdcPipelineSource → FlussSink)
// has no Flink SQL runtime — its topology lives in pipeline.yaml — so synthesis
// emits ONLY `--` comment banners. `buildBlocks` then yields no blocks, and the
// webview must show a real "no SQL" message instead of the "Waiting…"
// placeholder (the bug this fixes).
const commentOnlyPipeline: SynthPipeline = {
  id: "ingest",
  statements: [
    "-- ============\n-- PIPELINE CONNECTOR\n-- ============",
    "-- This pipeline is a Flink CDC Pipeline Connector job.\n-- The runtime definition lives in pipeline.yaml (ConfigMap-mounted),\n-- not in Flink SQL. Inspect pipeline.yaml and deployment.yaml.",
  ],
  statementOrigins: [],
  statementContributors: [],
  statementMeta: [
    [0, { label: "Pipeline Connector", section: "configuration" }],
  ],
}

describe("comment-only pipeline (CDC Pipeline Connector)", () => {
  it("buildBlocks yields no blocks — every statement is a banner", () => {
    expect(buildBlocks(commentOnlyPipeline)).toHaveLength(0)
  })

  it("noSqlMessage gives a real heading, never the 'Waiting…' wording", () => {
    const msg = noSqlMessage(commentOnlyPipeline)
    expect(msg.heading).toBeTruthy()
    expect(msg.heading).not.toMatch(/waiting/i)
  })

  it("noSqlMessage distinguishes a genuinely empty pipeline", () => {
    const empty: SynthPipeline = { ...commentOnlyPipeline, statements: [] }
    expect(noSqlMessage(empty).heading).not.toBe(
      noSqlMessage(commentOnlyPipeline).heading,
    )
  })

  it("noSqlMessage surfaces the pipeline.yaml explanation in detail", () => {
    const { detail } = noSqlMessage(commentOnlyPipeline)
    // The DSL-authored prose survives, stripped of comment markers…
    expect(detail).toContain("pipeline.yaml")
    expect(detail).toContain("Flink CDC Pipeline Connector job")
    expect(detail).not.toMatch(/--/)
    // …while banner furniture (`====` rules, ALL-CAPS titles) is dropped.
    expect(detail).not.toContain("=")
    expect(detail).not.toContain("PIPELINE CONNECTOR")
  })

  it("noSqlMessage keeps detail empty for a genuinely empty pipeline", () => {
    const empty: SynthPipeline = { ...commentOnlyPipeline, statements: [] }
    expect(noSqlMessage(empty).detail).toBe("")
  })
})
