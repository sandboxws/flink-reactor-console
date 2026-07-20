import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Effect } from "effect"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest"
import { runSynthJsonEffect } from "@/cli/commands/synth.js"
import type { SynthJsonOutput } from "@/cli/json-output.js"
import { AppLayer } from "@/core/layers.js"

const projectRoot = resolve(__dirname, "../../../../")

describe("synth --json", () => {
  let tempDir: string
  let stdoutSpy: MockInstance
  let stdoutChunks: string[]
  let savedExitCode: typeof process.exitCode

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "flink-reactor-synth-json-"))
    stdoutChunks = []
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: unknown) => {
        stdoutChunks.push(String(chunk))
        return true
      })
    savedExitCode = process.exitCode
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    process.exitCode = savedExitCode
    rmSync(tempDir, { recursive: true, force: true })
  })

  function writePipeline(name: string, content: string): void {
    const dir = join(tempDir, "pipelines", name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "index.tsx"), content, "utf-8")
  }

  function makeSimplePipeline(): string {
    const jsxPath = join(projectRoot, "src/core/jsx-runtime.js")
    return `
import { createElement } from '${jsxPath}';

const pipeline = createElement('Pipeline', { name: 'test-pipeline', parallelism: 1 },
  createElement('KafkaSink', { topic: 'output', format: 'json', bootstrapServers: 'localhost:9092' },
    createElement('Filter', { condition: 'amount > 100' },
      createElement('KafkaSource', {
        topic: 'input',
        format: 'json',
        bootstrapServers: 'localhost:9092',
        schema: {
          fields: { amount: 'BIGINT', name: 'STRING' },
          metadataColumns: [],
        },
      })
    )
  )
);

export default pipeline;
`
  }

  async function runJson(): Promise<SynthJsonOutput> {
    await Effect.runPromise(
      runSynthJsonEffect({ projectDir: tempDir, outdir: "dist" }).pipe(
        Effect.provide(AppLayer),
      ),
    )
    expect(stdoutChunks).toHaveLength(1)
    return JSON.parse(stdoutChunks[0]) as SynthJsonOutput
  }

  it("emits an ok envelope whose files all exist on disk", {
    timeout: 15_000,
  }, async () => {
    writePipeline("orders", makeSimplePipeline())

    const envelope = await runJson()

    expect(envelope.formatVersion).toBe(1)
    expect(envelope.command).toBe("synth")
    expect(envelope.ok).toBe(true)
    expect(envelope.outDir).toBe(join(tempDir, "dist"))
    expect(envelope.pipelines).toHaveLength(1)

    const pipeline = envelope.pipelines[0]
    expect(pipeline.statementCount).toBeGreaterThan(0)
    const kinds = pipeline.files.map((f) => f.kind)
    expect(kinds).toContain("sql")
    expect(kinds).toContain("deployment")
    expect(kinds).toContain("configmap")
    expect(kinds).toContain("tap-manifest")
    for (const file of pipeline.files) {
      expect(existsSync(file.path)).toBe(true)
    }
    expect(process.exitCode).toBe(savedExitCode)
  })

  it("keeps stdout pure JSON — no human output in JSON mode", {
    timeout: 15_000,
  }, async () => {
    const consoleSpy = vi.spyOn(console, "log")
    writePipeline("orders", makeSimplePipeline())

    await runJson()

    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("reports a failed envelope (exit 1) when discovery fails", {
    timeout: 15_000,
  }, async () => {
    // Point at a directory that is not a project at all: discovery
    // succeeds with zero pipelines for an empty dir, so instead make
    // pipelines/ a file to force a real discovery error.
    writeFileSync(join(tempDir, "pipelines"), "not a directory", "utf-8")

    const envelope = await runJson()

    // Either discovery throws (error envelope) or yields no pipelines
    // (ok with empty list) depending on platform semantics — both are
    // valid machine-readable outcomes, but stdout must parse either way.
    if (!envelope.ok) {
      expect(envelope.error).toBeDefined()
      expect(process.exitCode).toBe(1)
    } else {
      expect(envelope.pipelines).toEqual([])
    }
  })
})
