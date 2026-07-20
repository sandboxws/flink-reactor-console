import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  hasWorkspaceTypeScript,
  shouldPromptForWorkspaceTs,
} from "../src/config/ts-version-prompt.js"

const here = dirname(fileURLToPath(import.meta.url))
const noTsFixture = join(here, "fixtures", "root-alias")

// Build the `node_modules/typescript/lib/tsserver.js` fixture at runtime: a
// committed copy would sit under a gitignored `node_modules/` path and vanish
// on a fresh clone.
let withTsDir: string
beforeAll(() => {
  withTsDir = mkdtempSync(join(tmpdir(), "fr-ts-"))
  const lib = join(withTsDir, "node_modules", "typescript", "lib")
  mkdirSync(lib, { recursive: true })
  writeFileSync(join(lib, "tsserver.js"), "// fixture")
})
afterAll(() => {
  rmSync(withTsDir, { recursive: true, force: true })
})

describe("hasWorkspaceTypeScript", () => {
  it("detects a workspace typescript install", () => {
    expect(hasWorkspaceTypeScript(withTsDir)).toBe(true)
  })

  it("returns false when the project has no typescript", () => {
    expect(hasWorkspaceTypeScript(noTsFixture)).toBe(false)
  })
})

describe("shouldPromptForWorkspaceTs", () => {
  it("prompts when on bundled TS with a workspace install and not dismissed", () => {
    expect(
      shouldPromptForWorkspaceTs({
        workspaceTypeScriptPresent: true,
        tsdkConfigured: false,
        dismissed: false,
      }),
    ).toBe(true)
  })

  it("does not prompt when tsdk is already configured", () => {
    expect(
      shouldPromptForWorkspaceTs({
        workspaceTypeScriptPresent: true,
        tsdkConfigured: true,
        dismissed: false,
      }),
    ).toBe(false)
  })

  it("does not prompt without a workspace TypeScript", () => {
    expect(
      shouldPromptForWorkspaceTs({
        workspaceTypeScriptPresent: false,
        tsdkConfigured: false,
        dismissed: false,
      }),
    ).toBe(false)
  })

  it("does not prompt once dismissed", () => {
    expect(
      shouldPromptForWorkspaceTs({
        workspaceTypeScriptPresent: true,
        tsdkConfigured: false,
        dismissed: true,
      }),
    ).toBe(false)
  })
})
