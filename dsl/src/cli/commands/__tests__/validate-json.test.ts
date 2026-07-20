import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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
import { runValidateJsonEffect } from "@/cli/commands/validate.js"
import type { ValidateJsonOutput } from "@/cli/json-output.js"

const projectRoot = resolve(__dirname, "../../../../")

describe("validate --json", () => {
  let tempDir: string
  let stdoutSpy: MockInstance
  let stdoutChunks: string[]
  let savedExitCode: typeof process.exitCode

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "flink-reactor-validate-json-"))
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

  function jsxPath(): string {
    return join(projectRoot, "src/core/jsx-runtime.js")
  }

  async function runJson(): Promise<ValidateJsonOutput> {
    await Effect.runPromise(runValidateJsonEffect({ projectDir: tempDir }))
    expect(stdoutChunks).toHaveLength(1)
    return JSON.parse(stdoutChunks[0]) as ValidateJsonOutput
  }

  const validPipeline = `
import { createElement } from '${jsxPath()}';

const pipeline = createElement('Pipeline', { name: 'valid-pipeline' },
  createElement('KafkaSink', { topic: 'output', format: 'json', bootstrapServers: 'localhost:9092' },
    createElement('Filter', { condition: 'amount > 100' },
      createElement('KafkaSource', {
        topic: 'input',
        format: 'json',
        bootstrapServers: 'localhost:9092',
        schema: {
          fields: { amount: 'BIGINT' },
          metadataColumns: [],
        },
      })
    )
  )
);

export default pipeline;
`

  // An orphan source: declared under Pipeline but never consumed.
  const orphanPipeline = `
import { createElement } from '${jsxPath()}';

const pipeline = createElement('Pipeline', { name: 'orphan-pipeline' },
  createElement('KafkaSource', {
    topic: 'input',
    format: 'json',
    bootstrapServers: 'localhost:9092',
    schema: { fields: { amount: 'BIGINT' }, metadataColumns: [] },
  })
);

export default pipeline;
`

  it("emits an ok envelope for a valid project", {
    timeout: 15_000,
  }, async () => {
    writePipeline("orders", validPipeline)

    const envelope = await runJson()

    expect(envelope.formatVersion).toBe(1)
    expect(envelope.command).toBe("validate")
    expect(envelope.tool.name).toBe("flink-reactor")
    expect(envelope.ok).toBe(true)
    expect(envelope.error).toBeUndefined()
    expect(envelope.pipelines).toHaveLength(1)
    expect(envelope.pipelines[0].name).toBe("orders")
    expect(envelope.pipelines[0].ok).toBe(true)
    expect(envelope.pipelines[0].errors).toEqual([])
    expect(envelope.durationMs).toBeGreaterThanOrEqual(0)
    expect(() => new Date(envelope.startedAt)).not.toThrow()
    expect(process.exitCode).toBe(savedExitCode)
  })

  it("flips ok and sets exit code 1 on validation errors", {
    timeout: 15_000,
  }, async () => {
    writePipeline("orphan", orphanPipeline)

    const envelope = await runJson()

    expect(envelope.ok).toBe(false)
    expect(envelope.pipelines).toHaveLength(1)
    expect(envelope.pipelines[0].ok).toBe(false)
    expect(
      envelope.pipelines[0].errors.some((e) =>
        e.message.includes("Orphan source"),
      ),
    ).toBe(true)
    expect(process.exitCode).toBe(1)
  })

  it("emits ok with empty pipelines for a project without pipelines", {
    timeout: 15_000,
  }, async () => {
    mkdirSync(join(tempDir, "pipelines"), { recursive: true })

    const envelope = await runJson()

    expect(envelope.ok).toBe(true)
    expect(envelope.pipelines).toEqual([])
    expect(process.exitCode).toBe(savedExitCode)
  })

  it("keeps stdout pure JSON — no human output in JSON mode", {
    timeout: 15_000,
  }, async () => {
    const consoleSpy = vi.spyOn(console, "log")
    writePipeline("orders", validPipeline)

    await runJson()

    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
