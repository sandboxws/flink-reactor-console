// Bundles the VS Code extension host AND the DAG webview.
//
// The extension runs in VS Code's CJS extension host, so `vscode` is provided
// by the runtime and MUST stay external. Everything else — `vscode-languageclient`
// and `jsonc-parser` — is inlined so the `.vsix` carries no `node_modules`
// (we package with `vsce --no-dependencies`). The language SERVER is a separate
// process and is shipped under `server/` by `scripts/prepare-server.mjs`, not
// bundled here.
//
// Each webview (`dag-visualization`, `sql-preview`) is a SEPARATE browser/IIFE
// bundle written under `dist/webview/` and loaded into the sandboxed webview
// with a CSP + nonce. They are dumb renderers — they import no DSL and no Node
// APIs.
import * as esbuild from "esbuild"

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/** @type {import('esbuild').BuildOptions} */
const hostOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  // Prefer ESM entry points. `jsonc-parser`'s `main` is a UMD bundle whose
  // factory does a runtime `require("./impl/format")` that esbuild cannot
  // statically follow — bundling it leaves a dangling require that throws at
  // activation. Its `module` field is a clean ESM build that bundles fully.
  mainFields: ["module", "main"],
  sourcemap: !production,
  minify: production,
  logLevel: "info",
}

/** @type {import('esbuild').BuildOptions} */
const sharedWebview = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
}

/** @type {import('esbuild').BuildOptions} */
const graphWebview = {
  ...sharedWebview,
  entryPoints: ["src/graph/webview/main.ts"],
  outfile: "dist/webview/graph.js",
}

/** @type {import('esbuild').BuildOptions} */
const sqlPreviewWebview = {
  ...sharedWebview,
  entryPoints: ["src/preview/webview/main.ts"],
  outfile: "dist/webview/sql-preview.js",
}

/** @type {import('esbuild').BuildOptions} */
const crdPreviewWebview = {
  ...sharedWebview,
  entryPoints: ["src/preview/crd-webview/main.ts"],
  outfile: "dist/webview/crd-preview.js",
}

/** @type {import('esbuild').BuildOptions} */
const tapsWebview = {
  ...sharedWebview,
  entryPoints: ["src/taps/webview/main.ts"],
  outfile: "dist/webview/taps.js",
}

if (watch) {
  const contexts = await Promise.all([
    esbuild.context(hostOptions),
    esbuild.context(graphWebview),
    esbuild.context(sqlPreviewWebview),
    esbuild.context(crdPreviewWebview),
    esbuild.context(tapsWebview),
  ])
  await Promise.all(contexts.map((c) => c.watch()))
  console.log("[esbuild] watching host + webviews…")
} else {
  await Promise.all([
    esbuild.build(hostOptions),
    esbuild.build(graphWebview),
    esbuild.build(sqlPreviewWebview),
    esbuild.build(crdPreviewWebview),
    esbuild.build(tapsWebview),
  ])
  console.log(
    `[esbuild] built dist/extension.js + dist/webview/{graph,sql-preview,crd-preview,taps}.js (${production ? "production" : "development"})`,
  )
}
