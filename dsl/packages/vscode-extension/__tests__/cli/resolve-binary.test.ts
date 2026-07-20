// CLI binary resolution (cli-lifecycle-integration task 1.5): the
// workspace > cliPath > PATH order, and the structured not-found result.

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { resolveCliBinary } from "../../src/cli/resolve-binary"

const BIN = process.platform === "win32" ? "flink-reactor.cmd" : "flink-reactor"
const root = join(tmpdir(), `fr-resolve-${process.pid}`)
const projectWithBin = join(root, "with-bin")
const projectBare = join(root, "bare")
const settingDir = join(root, "setting")
const pathDir = join(root, "on-path")

beforeAll(() => {
  for (const dir of [
    join(projectWithBin, "node_modules", ".bin"),
    projectBare,
    settingDir,
    pathDir,
  ]) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(
    join(projectWithBin, "node_modules", ".bin", BIN),
    "#!/bin/sh\n",
  )
  writeFileSync(join(settingDir, BIN), "#!/bin/sh\n")
  writeFileSync(join(pathDir, BIN), "#!/bin/sh\n")
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("resolveCliBinary", () => {
  it("prefers the workspace node_modules binary over everything", () => {
    const result = resolveCliBinary({
      projectDir: projectWithBin,
      cliPathSetting: join(settingDir, BIN),
      pathEnv: pathDir,
    })
    expect(result).toEqual({
      kind: "found",
      path: join(projectWithBin, "node_modules", ".bin", BIN),
      source: "workspace",
    })
  })

  it("falls back to the cliPath setting when node_modules has no binary", () => {
    const result = resolveCliBinary({
      projectDir: projectBare,
      cliPathSetting: join(settingDir, BIN),
      pathEnv: pathDir,
    })
    expect(result).toEqual({
      kind: "found",
      path: join(settingDir, BIN),
      source: "setting",
    })
  })

  it("falls back to PATH last", () => {
    const result = resolveCliBinary({
      projectDir: projectBare,
      cliPathSetting: "",
      pathEnv: [join(root, "missing"), pathDir].join(delimiter),
    })
    expect(result).toEqual({
      kind: "found",
      path: join(pathDir, BIN),
      source: "PATH",
    })
  })

  it("returns a structured, actionable not-found result", () => {
    const result = resolveCliBinary({
      projectDir: projectBare,
      cliPathSetting: join(root, "nope", BIN),
      pathEnv: join(root, "missing"),
    })
    expect(result.kind).toBe("not-found")
    if (result.kind === "not-found") {
      expect(result.message).toMatch(/flinkReactor\.cliPath/)
      expect(result.message).toMatch(/install/i)
    }
  })
})
