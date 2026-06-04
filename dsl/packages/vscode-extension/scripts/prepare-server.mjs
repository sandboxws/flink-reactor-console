// Vendors the FlinkReactor language server into `server/` so the packaged
// `.vsix` is self-contained (we package with `vsce --no-dependencies`, which
// does NOT walk node_modules). At runtime `src/client/launch.ts` prefers the
// user's workspace install and falls back to this bundled copy.
//
// We copy the server's `dist/` + `bin/`, and best-effort vendor the runtime
// deps it keeps external (`jiti` and `@flink-reactor/dsl`). The user's own
// project still takes precedence for the DSL — the loader resolves the DSL the
// project depends on first; this copy is only the no-prior-install fallback.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs"
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

/**
 * Vendor a runtime dep by copying exactly what it declares it ships (its
 * `files` field) plus its manifest, so its `exports` map resolves at runtime.
 * Hardcoding `dist/` was wrong for `jiti`, whose entry points live in `lib/`
 * (`exports["."].import → ./lib/jiti.mjs`): the worker's `import "jiti"` then
 * failed with "Cannot find module .../jiti/lib/jiti.mjs", breaking ALL
 * synthesis in the packaged server. Copying the declared `files` keeps the
 * payload lean without assuming a layout.
 */
function vendorDep(name, { only } = {}) {
  copyInto(name, "package.json")
  // `only` overrides the files-field heuristic for deps where we need just a
  // slice of the package (e.g. `typescript` — see the call site).
  if (only) {
    for (const sub of only) copyInto(name, sub)
    return
  }
  let files
  try {
    const manifest = JSON.parse(
      readFileSync(join(packageDir(name), "package.json"), "utf-8"),
    )
    files = Array.isArray(manifest.files) ? manifest.files : null
  } catch {
    files = null
  }
  // Fall back to `dist` when a package declares no `files` (our own packages).
  const subs = files?.length ? files : ["dist"]
  for (const sub of subs) {
    // Skip globs, negations, and parent escapes — copy plain dir/file entries
    // only (a `files` entry like `!lib/enu` is an exclude, not a path to copy).
    if (
      sub.includes("*") ||
      sub.startsWith("!") ||
      sub.startsWith("..") ||
      sub === "package.json"
    ) {
      continue
    }
    copyInto(name, sub)
  }
}

// Best-effort runtime deps for the no-prior-install fallback path — the
// specifiers the server bundle keeps external (the language-server's tsup
// `external`): the DSL + ts-plugin and `jiti`.
for (const dep of ["@flink-reactor/dsl", "@flink-reactor/ts-plugin", "jiti"]) {
  vendorDep(dep)
}

// `typescript` is external in the server bundle (`import ts from "typescript"`)
// but the package is 23 MB. The server uses only SYNTACTIC APIs
// (`ts.createSourceFile` + AST walking — no `createProgram`/type checker), so
// it needs just the self-contained compiler bundle (`lib/typescript.js`,
// 8.7 MB) — not the `lib.*.d.ts` standard library or the tsc/tsserver CLIs.
// Without this, the bundled fallback server crashed at load with
// ERR_MODULE_NOT_FOUND ('typescript'). If a provider ever type-checks (i.e.
// calls `createProgram`), also vendor `lib/lib*.d.ts`.
vendorDep("typescript", { only: ["lib/typescript.js"] })

console.log(`[prepare-server] vendored language server into ${serverOut}`)
