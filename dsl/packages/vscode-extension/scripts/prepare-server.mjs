// Vendors the FlinkReactor language server into `server/` so the packaged
// `.vsix` is self-contained (we package with `vsce --no-dependencies`, which
// does NOT walk node_modules). At runtime `src/client/launch.ts` prefers the
// user's workspace install and falls back to this bundled copy.
//
// We copy the server's `dist/` + `bin/`, and best-effort vendor the runtime
// deps it keeps external (`jiti` and `@flink-reactor/dsl`). The user's own
// project still takes precedence for the DSL — the loader resolves the DSL the
// project depends on first; this copy is only the no-prior-install fallback.
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, "..")
const serverOut = join(pkgRoot, "server")

/**
 * Resolve a package's root directory. Prefer the symlink pnpm placed in this
 * package's `node_modules` (resolving the real path through it) — a package with
 * an `exports` map blocks `require.resolve("<name>/package.json")`, so we cannot
 * probe package.json directly. Fall back to resolving the main entry and walking
 * up to the nearest package.json.
 */
function packageDir(name) {
  const linked = join(pkgRoot, "node_modules", name)
  if (existsSync(linked)) return realpathSync(linked)
  let dir = dirname(require.resolve(name))
  while (!existsSync(join(dir, "package.json"))) {
    const up = dirname(dir)
    if (up === dir) throw new Error(`cannot locate ${name}`)
    dir = up
  }
  return dir
}

function copyInto(name, sub) {
  const from = join(packageDir(name), sub)
  if (!existsSync(from)) {
    console.warn(`[prepare-server] skip ${name}/${sub} (not built?)`)
    return false
  }
  const to = join(serverOut, "node_modules", name, sub)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true, dereference: true })
  return true
}

rmSync(serverOut, { recursive: true, force: true })
mkdirSync(serverOut, { recursive: true })

const lsDir = packageDir("@flink-reactor/language-server")
for (const sub of ["dist", "bin", "package.json"]) {
  const from = join(lsDir, sub)
  if (!existsSync(from)) {
    console.error(
      `[prepare-server] language-server is missing ${sub}; run its build first`,
    )
    process.exit(1)
  }
  cpSync(from, join(serverOut, sub), { recursive: true, dereference: true })
}

// Best-effort runtime deps for the no-prior-install fallback path.
for (const dep of ["@flink-reactor/dsl", "@flink-reactor/ts-plugin", "jiti"]) {
  copyInto(dep, "dist")
  copyInto(dep, "package.json")
}

console.log(`[prepare-server] vendored language server into ${serverOut}`)
