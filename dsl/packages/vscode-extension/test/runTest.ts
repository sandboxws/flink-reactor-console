import { cpSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runTests } from "@vscode/test-electron"

async function main(): Promise<void> {
  try {
    // dist-test/test → package root is two levels up.
    const extensionDevelopmentPath = resolve(__dirname, "..", "..")
    const extensionTestsPath = resolve(__dirname, "suite", "index")

    // Open a throwaway copy of the fixture so the committed one stays pristine —
    // the ts-plugin auto-config test mutates the workspace tsconfig.json.
    const fixture = resolve(
      extensionDevelopmentPath,
      "test",
      "fixtures",
      "workspace",
    )
    const workspace = mkdtempSync(join(tmpdir(), "fr-e2e-"))
    cpSync(fixture, workspace, { recursive: true })

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspace, "--disable-extensions"],
    })
  } catch (err) {
    console.error("E2E test run failed:", err)
    process.exit(1)
  }
}

void main()
