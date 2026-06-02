import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { DocumentSynthState } from "../../src/document-state.js"
import { provideHover } from "../../src/hover/provider.js"
import type { Position } from "../../src/hover/resolve.js"
import { buildPositionMap } from "../../src/mappers/source-position-mapper.js"
import { synthesizeDocument } from "../../src/synth/runner.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
const FILE = join(FIXTURES, "hover-pipeline.tsx")
const SRC = readFileSync(FILE, "utf-8")

/** Position `delta` chars into the first occurrence of a distinctive `anchor`. */
function posAt(anchor: string, delta: number): Position {
  const idx = SRC.indexOf(anchor)
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`)
  const at = idx + delta
  const before = SRC.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    character: at - (before.lastIndexOf("\n") + 1),
  }
}

const cardValue = (h: ReturnType<typeof provideHover>): string =>
  (h?.contents as { value: string } | undefined)?.value ?? ""

describe("provideHover", () => {
  let state: DocumentSynthState
  beforeAll(async () => {
    const result = await synthesizeDocument({
      entryPoint: FILE,
      projectDir: FIXTURES,
    })
    expect(result.ok).toBe(true)
    state = {
      uri: "file:///hover-pipeline.tsx",
      version: 1,
      result,
      positionMap: buildPositionMap(SRC, FILE, result.nodes),
    }
  })

  const hover = (pos: Position, version = 1) =>
    provideHover({
      state,
      sourceText: SRC,
      fileName: FILE,
      position: pos,
      documentVersion: version,
    })

  it("tag hover returns a full component card", () => {
    const value = cardValue(hover(posAt("<KafkaSource", 3)))
    expect(value).toContain("Reads from an Apache Kafka topic")
    expect(value).toContain("order_id")
    expect(value).toContain("Changelog mode")
  })

  it("sink tag hover returns the sink card (accepted modes + compatibility)", () => {
    const value = cardValue(hover(posAt("<JdbcSink", 3)))
    expect(value).toContain("Accepts changelog modes")
    expect(value).toContain("compatible")
    expect(value).toContain("INSERT INTO")
  })

  it("prop hover returns the connector-prop card", () => {
    const value = cardValue(hover(posAt('topic="', 2)))
    expect(value).toContain("Kafka topic to read from")
    expect(value).toContain("required")
  })

  it("column-ref hover returns the field's inferred Flink type", () => {
    const value = cardValue(hover(posAt("amount > 0", 2)))
    expect(value).toContain("DECIMAL")
  })

  it("a non-FlinkReactor position returns null (defers to ts-plugin)", () => {
    expect(hover(posAt("Field,", 2))).toBeNull() // import specifier, not a JSX tag
  })

  it("a stale document version yields a static card with a synthesis-pending note", () => {
    const value = cardValue(hover(posAt("<KafkaSource", 3), 2))
    expect(value).toContain("KafkaSource")
    expect(value).toContain("synthesis pending")
    expect(value).not.toContain("| column | type |") // no stale schema while pending
  })
})
