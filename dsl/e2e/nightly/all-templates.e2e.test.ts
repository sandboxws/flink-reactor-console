// Nightly full-matrix sweep: every template scaffolds, validates, and
// synthesizes against the packed artifact. Gated behind FR_E2E_ALL=1
// (`pnpm test:e2e:all`) — the default suite covers a representative
// subset; this catches regressions in the long tail.

import { existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { ALL_TEMPLATES, DEFAULT_TEMPLATES } from "../helpers/templates.js"
import {
  createE2eContext,
  type E2eContext,
  type E2eProject,
} from "../helpers/test-context.js"

const defaultNames = new Set(DEFAULT_TEMPLATES.map((t) => t.template))
const NIGHTLY_ONLY = ALL_TEMPLATES.filter((t) => !defaultNames.has(t.template))

describe.each(NIGHTLY_ONLY)("nightly template $template", ({
  template,
  pipelines,
}) => {
  let ctx: E2eContext
  let project: E2eProject

  beforeAll(async () => {
    ctx = createE2eContext()
    project = await ctx.scaffold(template)
  }, 600_000)

  afterAll(() => {
    ctx.cleanupAll()
  })

  it("validates clean", async () => {
    const result = await project.validate()
    expect(result.exitCode, result.stdout + result.stderr).toBe(0)
  })

  it("synthesizes every expected pipeline", async () => {
    const result = await project.synth()

    expect(result.exitCode, result.stdout + result.stderr).toBe(0)
    for (const name of pipelines) {
      expect(
        existsSync(join(project.dir, "dist", name, "pipeline.sql")),
        `dist/${name}/pipeline.sql`,
      ).toBe(true)
      expect(
        existsSync(join(project.dir, "dist", name, "deployment.yaml")),
        `dist/${name}/deployment.yaml`,
      ).toBe(true)
    }
  })
})
