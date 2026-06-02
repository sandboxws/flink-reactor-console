// Bundles the VS Code extension host AND the DAG webview.
//
// The extension runs in VS Code's CJS extension host, so `vscode` is provided
// by the runtime and MUST stay external. Everything else — `vscode-languageclient`
// and `jsonc-parser` — is inlined so the `.vsix` carries no `node_modules`
// (we package with `vsce --no-dependencies`). The language SERVER is a separate
// process and is shipped under `server/` by `scripts/prepare-server.mjs`, not
// bundled here.
//
// The webview (`dag-visualization`) is a SEPARATE browser/IIFE bundle written to
// `dist/webview/graph.js` and loaded into the sandboxed webview with a CSP +
// nonce. It is a dumb renderer — it imports no DSL and no Node APIs.
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
const webviewOptions = {
  entryPoints: ["src/graph/webview/main.ts"],
  bundle: true,
  outfile: "dist/webview/graph.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
}

if (watch) {
  const host = await esbuild.context(hostOptions)
  const webview = await esbuild.context(webviewOptions)
  await Promise.all([host.watch(), webview.watch()])
  console.log("[esbuild] watching host + webview…")
} else {
  await Promise.all([esbuild.build(hostOptions), esbuild.build(webviewOptions)])
  console.log(
    `[esbuild] built dist/extension.js + dist/webview/graph.js (${production ? "production" : "development"})`,
  )
}
