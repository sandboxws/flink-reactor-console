// Black-box CLI surface checks against the packed artifact. No scaffold,
// no install — just the binary in an empty directory.

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  createE2eContext,
  type E2eContext,
  type E2eProject,
} from "./helpers/test-context.js"

describe("cli surface (packed artifact)", () => {
  let ctx: E2eContext
  let project: E2eProject

  beforeAll(() => {
    ctx = createE2eContext()
    project = ctx.emptyProject()
  })

  afterAll(() => {
    ctx.cleanupAll()
  })

  it("--version prints the injected semver (build-time __DSL_VERSION__)", async () => {
    const result = await project.run(["--version"])

    expect(result.exitCode).toBe(0)
    // A broken esbuild `define` injection ships "undefined" or the raw
    // placeholder — a past packaged-artifact bug shape.
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it("--help lists the core commands", async () => {
    const result = await project.run(["--help"])

    expect(result.exitCode).toBe(0)
    for (const command of ["new", "synth", "validate", "graph", "doctor"]) {
      expect(result.stdout).toContain(command)
    }
  })

  it("an unknown subcommand exits non-zero", async () => {
    const result = await project.run(["definitely-not-a-command"])

    expect(result.exitCode).not.toBe(0)
  })
})
