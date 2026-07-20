import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import type {
  SynthFragment,
  SynthStatementMeta,
  SynthStatementOrigin,
} from "../../src/preview/model"
import { buildSynthModel } from "../../src/providers/synth-model"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

async function model(name: string, version = 7) {
  const entryPoint = join(FIXTURES, name)
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  return buildSynthModel(pathToFileURL(entryPoint).href, version, result)
}

/** Reconstruct the number-keyed maps the webview rebuilds from entry arrays. */
function maps(p: {
  statementOrigins: ReadonlyArray<readonly [number, SynthStatementOrigin]>
  statementContributors: ReadonlyArray<
    readonly [number, readonly SynthFragment[]]
  >
  statementMeta: ReadonlyArray<readonly [number, SynthStatementMeta]>
}) {
  return {
    origins: new Map(p.statementOrigins),
    contributors: new Map(p.statementContributors),
    meta: new Map(p.statementMeta),
  }
}

describe("buildSynthModel", () => {
  // 1.1/1.3/1.4 — one pipeline, version-stamped, keyed by `<Pipeline name>`.
  it("projects a linear pipeline to one version-stamped, keyed result", async () => {
    const m = await model("dag-linear-pipeline.tsx")

    expect(m.ok).toBe(true)
    expect(m.version).toBe(7)
    expect(m.pipelines).toHaveLength(1)
    expect(m.pipelines[0].id).toBe("dag-linear")
    expect(m.pipelines[0].statements.length).toBeGreaterThan(0)
  })

  // 3.2/3.3 — statements arrive in canonical synthesis order; `statementMeta`
  // labels the comment banner that *precedes* each real statement (banner index
  // `b` describes the body at `b + 1`), carrying the section grouping.
  it("carries statements in synthesis order with banner-keyed labels and sections", async () => {
    const [p] = (await model("dag-linear-pipeline.tsx")).pipelines
    const { meta } = maps(p)

    // The source's CREATE TABLE precedes the sink's INSERT INTO.
    const createIdx = p.statements.findIndex((s) =>
      s.includes("CREATE TABLE `orders`"),
    )
    const insertIdx = p.statements.findIndex((s) => s.includes("INSERT INTO"))
    expect(createIdx).toBeGreaterThan(0)
    expect(insertIdx).toBeGreaterThan(createIdx)

    // The label/section live on the banner one index before the real statement.
    const sourceMeta = meta.get(createIdx - 1)
    expect(sourceMeta?.label).toContain("orders")
    expect(sourceMeta?.section).toBe("sources")
    // The statement before the banner is a comment-only `--` banner (no SQL).
    expect(p.statements[createIdx - 1].trimStart().startsWith("--")).toBe(true)
  })

  // 1.1 — statementOrigins invert to "which node produced statement i": the
  // source owns its CREATE TABLE.
  it("maps statement origins back to the producing node", async () => {
    const [p] = (await model("dag-linear-pipeline.tsx")).pipelines
    const { origins } = maps(p)

    const createIdx = p.statements.findIndex((s) => s.includes("CREATE TABLE"))
    const origin = origins.get(createIdx)
    expect(origin?.nodeId).toBe("orders")
    expect(origin?.component).toBe("KafkaSource")
    expect(origin?.kind).toBe("Source")
  })

  // The compelling bit — a `<Filter>`'s exact WHERE-predicate byte span is
  // recorded as a contributor fragment whose `origin` is the Filter node id.
  it("records the Filter's contributed predicate span", async () => {
    const [p] = (await model("dag-linear-pipeline.tsx")).pipelines
    const { contributors } = maps(p)

    // Find the statement carrying a fragment attributed to the Filter node.
    let found: { stmt: string; fragment: SynthFragment } | undefined
    for (const [idx, fragments] of contributors) {
      const fragment = fragments.find((f) => f.origin === "Filter_1")
      if (fragment) {
        found = { stmt: p.statements[idx], fragment }
        break
      }
    }
    expect(found, "a fragment attributed to Filter_1").toBeDefined()
    if (!found) return
    // The span slices to the predicate the <Filter condition> produced. (SQL is
    // ASCII here, so byte offsets coincide with char offsets.)
    const span = found.stmt.slice(
      found.fragment.offset,
      found.fragment.offset + found.fragment.length,
    )
    expect(span).toContain("amount")
  })

  // 1.2/1.7 — round-trip serialization: the entry arrays reconstruct the
  // number-keyed maps, and the whole envelope survives JSON (no DSL refs).
  it("round-trips the number-keyed maps through JSON", async () => {
    const m = await model("dag-linear-pipeline.tsx")

    const clone = JSON.parse(JSON.stringify(m))
    expect(clone).toEqual(m)

    // Reconstructed maps key by the original statement indices.
    const { origins, contributors, meta } = maps(m.pipelines[0])
    for (const [idx] of origins) expect(typeof idx).toBe("number")
    expect(origins.size).toBeGreaterThan(0)
    expect(meta.size).toBeGreaterThan(0)
    // Every contributor index is a valid statement index.
    for (const [idx] of contributors) {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(m.pipelines[0].statements.length)
    }
  })

  // 1.6 — a throwing pipeline yields an ok:false envelope (with the failure
  // summary) instead of throwing.
  it("returns a failure envelope for a throwing pipeline without throwing", async () => {
    const entryPoint = join(FIXTURES, "throwing-pipeline.tsx")
    const result = await synthesizeDocument({
      entryPoint,
      projectDir: FIXTURES,
    })

    let m: ReturnType<typeof buildSynthModel> | undefined
    expect(() => {
      m = buildSynthModel(pathToFileURL(entryPoint).href, 3, result)
    }).not.toThrow()

    expect(m?.ok).toBe(false)
    expect(m?.error).toMatch(/boom/)
    expect(m?.pipelines).toEqual([])
    expect(m?.version).toBe(3)
  })
})
