import { defineConfig } from "tsup"

// The server bundles its own glue (server core, providers, mappers, synth
// host) into `dist/server.js`, and the isolation worker into a separate
// `dist/worker.js` that the runner spawns by path. Heavy runtime deps are
// kept external: `jiti` and the `@flink-reactor/dsl` packages must resolve
// at runtime (the loader evaluates the user's project against the DSL the
// project actually depends on), and `typescript` / `vscode-languageserver`
// are large standard deps with no benefit to inlining.
export default defineConfig({
  entry: {
    server: "src/server.ts",
    worker: "src/synth/worker.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: { entry: { server: "src/server.ts" } },
  sourcemap: true,
  splitting: false,
  // The bundled CJS `vscode-languageserver` calls `require("util")` etc. In an
  // ESM output esbuild's `__require` shim throws unless a real `require` is in
  // scope, so define one from `import.meta.url`.
  banner: {
    js: "import { createRequire as __frCreateRequire } from 'node:module'; const require = __frCreateRequire(import.meta.url);",
  },
  // `jiti` and the DSL packages must resolve at runtime (the loader evaluates
  // the user's project against the DSL it actually depends on); `typescript`
  // is large and ESM-importable as a root specifier. Everything else —
  // including `vscode-languageserver`, a CJS package with NO exports map whose
  // `/node` subpath cannot be imported from an ESM bundle — is bundled in.
  external: [
    "jiti",
    "typescript",
    "@flink-reactor/dsl",
    "@flink-reactor/dsl/node",
    "@flink-reactor/dsl/browser",
  ],
  noExternal: [
    "vscode-languageserver",
    "vscode-languageserver-protocol",
    "vscode-jsonrpc",
    "vscode-languageserver-textdocument",
  ],
})
