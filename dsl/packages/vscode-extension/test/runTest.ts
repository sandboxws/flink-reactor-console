import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runTests } from "@vscode/test-electron"

// A stub `flink-reactor` CLI for the cli-lifecycle e2e: records every
// invocation's argv to `.fr-cli-invocations.log` in the workspace root (the
// suite polls it to assert `-p`/`--env` construction), emits one problem-
// matcher-shaped diagnostic from `validate` while the `.fr-emit-diagnostic`
// marker exists (and none without it — the clean-run clearing assertion),
// and blocks on `dev` until terminated (the managed-watch lifecycle).
const STUB_CLI = `#!/bin/sh
ws="$(cd "$(dirname "$0")/../.." && pwd)"
echo "$@" >> "$ws/.fr-cli-invocations.log"
case "$1" in
  validate)
    if [ -f "$ws/.fr-emit-diagnostic" ]; then
      echo "pipelines/orders/index.tsx:13:5 error FR-TEST-001 stub diagnostic from validate"
    fi
    ;;
  dev)
    while true; do sleep 1; done
    ;;
esac
exit 0
`

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

    // The fixture's pipelines `import "@flink-reactor/dsl"`. A real project has
    // it installed; the bare fixture does not, so synthesis (jiti) would fail
    // with "Cannot find module '@flink-reactor/dsl'". Symlink the DSL package
    // (the repo root) into the temp workspace's node_modules so the loader
    // resolves it exactly as it would in a real install.
    const repoRoot = resolve(extensionDevelopmentPath, "..", "..")
    const scopeDir = join(workspace, "node_modules", "@flink-reactor")
    mkdirSync(scopeDir, { recursive: true })
    symlinkSync(repoRoot, join(scopeDir, "dsl"), "dir")

    // The cli-lifecycle suite resolves the workspace
    // `node_modules/.bin/flink-reactor` first — give it the recording stub.
    const binDir = join(workspace, "node_modules", ".bin")
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, "flink-reactor"), STUB_CLI, { mode: 0o755 })

    // VS Code creates its main IPC handle as a Unix-domain socket under
    // `--user-data-dir`; macOS caps that socket path at ~103 chars. The default
    // (`<repo>/.vscode-test/user-data`) overflows on a deep checkout and VS Code
    // fails to launch with `EINVAL`. Pin user-data to a short temp dir so the
    // e2e runs regardless of how deep the repo is cloned.
    const userDataDir = mkdtempSync(join(tmpdir(), "fr-ud-"))

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        workspace,
        "--disable-extensions",
        `--user-data-dir=${userDataDir}`,
      ],
    })
  } catch (err) {
    console.error("E2E test run failed:", err)
    process.exit(1)
  }
}

void main()
