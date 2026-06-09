import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "tsup"

const srcAlias = { "@": resolve("src") }
const pkg = JSON.parse(readFileSync("package.json", "utf-8"))
const dslVersion = pkg.version as string

// dt-sql-parser's published dist is bundler-only: ESM syntax in a
// package without `"type": "module"`, with extensionless directory
// imports plain Node ESM rejects. It therefore ships as a dedicated
// pre-bundled vendor chunk (entry below), reached lazily at runtime via
// the self-referencing `@flink-reactor/dsl/vendor-dt-sql-parser` subpath
// (see package.json `exports` and src/core/flink-sql-loader.ts, which
// falls back to the bare package in bundler-resolved contexts).

export default defineConfig([
  // Library entry — importable as `import { ... } from '@flink-reactor/dsl'`
  // and as `import { ... } from '@flink-reactor/dsl/plugins'`. The plugins
  // subpath is its own bundle (not a re-export from index) so users who
  // never opt into Grafana / metrics don't pay for the plugins code in
  // their config eval. A matching `./plugins` entry must exist in
  // package.json `exports` — Node's ESM resolver refuses unlisted subpaths
  // even when the file is on disk.
  {
    entry: {
      index: "src/index.ts",
      "jsx-runtime": "src/jsx-runtime.ts",
      "jsx-dev-runtime": "src/jsx-dev-runtime.ts",
      plugins: "src/plugins/index.ts",
      // Node-only loader subpath (`@flink-reactor/dsl/node`) — sibling of
      // the browser bundle, used by the language server to load pipelines.
      node: "src/node.ts",
    },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    // NOTE: clean is handled once via the `build` script (rm -rf dist) BEFORE
    // tsup runs. Per-config `clean: true` races with the separate `browser`
    // config (which shares this outDir but builds in parallel) and can wipe
    // `dist/browser.d.ts` after it is written.
    clean: false,
    dts: true,
    sourcemap: true,
    splitting: false,
    esbuildOptions(options) {
      options.alias = srcAlias
    },
  },
  // CLI entry — `flink-reactor` bin
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: false,
    dts: false,
    sourcemap: true,
    splitting: false,
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
    esbuildOptions(options) {
      options.alias = srcAlias
      options.define = {
        ...options.define,
        __DSL_VERSION__: JSON.stringify(dslVersion),
      }
    },
  },
  // Browser entry — importable as `import { ... } from '@flink-reactor/dsl/browser'`
  {
    entry: { browser: "src/browser.ts" },
    format: ["esm"],
    target: "esnext",
    platform: "browser",
    outDir: "dist",
    clean: false,
    dts: true,
    sourcemap: true,
    splitting: false,
    minify: true,
    noExternal: ["effect", "dt-sql-parser"],
    esbuildOptions(options) {
      options.alias = srcAlias
    },
  },
  // Pre-bundled dt-sql-parser vendor chunk (see VENDOR_DT_SQL_PARSER).
  {
    entry: { "vendor-dt-sql-parser": "src/vendor/dt-sql-parser.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: false,
    dts: false,
    sourcemap: false,
    splitting: false,
    minify: true,
    noExternal: ["dt-sql-parser"],
    esbuildOptions(options) {
      options.alias = srcAlias
    },
  },
])
