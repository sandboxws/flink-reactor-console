// Project-Vitest resolution (test-explorer §3.1): the extension shells out
// to the PROJECT's Vitest — never a bundled/pinned copy. Prefers the
// `node_modules/.bin/vitest` shim; falls back to running the package's own
// entry (`node_modules/vitest/vitest.mjs`) under the current Node when the
// shim is absent (e.g. a symlinked install whose `.bin` was not materialized).
// A structured not-found result drives the graceful-degradation path
// (task 10.2): discovery still lists files, runs error with the reason.

import { existsSync } from "node:fs"
import { join } from "node:path"

export type ResolvedVitest =
  | {
      readonly kind: "found"
      /** The executable to spawn. */
      readonly command: string
      /** Arguments to PREPEND before vitest's own argv. */
      readonly prefixArgs: readonly string[]
    }
  | { readonly kind: "not-found"; readonly message: string }

export function resolveVitest(
  projectDir: string,
  nodeExecutable: string = process.execPath,
): ResolvedVitest {
  const shim = join(
    projectDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vitest.cmd" : "vitest",
  )
  if (existsSync(shim)) {
    return { kind: "found", command: shim, prefixArgs: [] }
  }
  const entry = join(projectDir, "node_modules", "vitest", "vitest.mjs")
  if (existsSync(entry)) {
    return { kind: "found", command: nodeExecutable, prefixArgs: [entry] }
  }
  return {
    kind: "not-found",
    message:
      "Vitest is not installed in this project — run `pnpm add -D vitest` " +
      "to enable running the pipeline tests.",
  }
}
