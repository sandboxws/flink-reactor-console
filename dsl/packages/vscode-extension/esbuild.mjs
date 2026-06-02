// Bundles the VS Code extension host into a single CommonJS file.
//
// The extension runs in VS Code's CJS extension host, so `vscode` is provided
// by the runtime and MUST stay external. Everything else — `vscode-languageclient`
// and `jsonc-parser` — is inlined so the `.vsix` carries no `node_modules`
// (we package with `vsce --no-dependencies`). The language SERVER is a separate
// process and is shipped under `server/` by `scripts/prepare-server.mjs`, not
// bundled here.
import * as esbuild from "esbuild"

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  sourcemap: !production,
  minify: production,
  logLevel: "info",
}

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log("[esbuild] watching…")
} else {
  await esbuild.build(options)
  console.log(
    `[esbuild] built dist/extension.js (${production ? "production" : "development"})`,
  )
}
