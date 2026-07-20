import { defineConfig } from "tsup"

// The server bundles its own glue (server core, providers, mappers, synth
// host) into `dist/server.js`, and the isolation worker into a separate
// `dist/worker.js` that the runner spawns by path. Heavy runtime deps are
// kept external: `jiti` and the `@flink-reactor/dsl` packages must resolve
// at runtime (the loader evaluates the user's project against the DSL the
// project actually depends on), and `typescript` / `vscode-languageserver`
// are large standard deps with no benefit to inlining.
export default defineConfig([
  {
    entry: {
      server: "src/server.ts",
      worker: "src/synth/worker.ts",
    },
    format: ["esm"],
    target: "node20",
    platform: "node",
    outDir: "dist",
    // Cleaning happens in the package `build` script: with two parallel
    // configs, an in-config `clean` races the sibling's outputs (the DTS
    // worker would delete the schema entry's freshly written `.d.ts`).
    clean: false,
    dts: { entry: { server: "src/server.ts" } },
    sourcemap: true,
    splitting: false,
    // The bundled CJS `vscode-languageserver` calls `require("util")` etc., and
    // `@ts-morph/common`'s embedded TypeScript reads `__filename` at load. In
    // an ESM output none of the CJS module-scope pseudo-globals exist, so
    // define the standard trio from `import.meta.url` — without `__filename`
    // the server crashed at boot (ReferenceError) once ts-morph was bundled.
    banner: {
      js: [
        "import { createRequire as __frCreateRequire } from 'node:module';",
        "import { fileURLToPath as __frFileURLToPath } from 'node:url';",
        "import { dirname as __frDirname } from 'node:path';",
        "const require = __frCreateRequire(import.meta.url);",
        "const __filename = __frFileURLToPath(import.meta.url);",
        "const __dirname = __frDirname(__filename);",
      ].join(" "),
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
      // The designer codemod engine. Bundled IN (unlike jiti/the DSL, which
      // must resolve against the user's project, or `typescript`, which is
      // shared with the vendored slice): ts-morph is an internal
      // implementation detail with no project-version coupling, and keeping
      // it external broke the packaged/vendored server at load with
      // ERR_MODULE_NOT_FOUND ('ts-morph') — which surfaced as every panel
      // timing out in the e2e suite.
      "ts-morph",
    ],
  },
  // Pure-data prop-form schema (visual-designer): published as the
  // `./prop-form-schema` subpath so the VS Code extension can inline the
  // table into any bundle (host CJS or webview IIFE). Built WITHOUT the
  // `import.meta` require banner — the module has zero imports and must stay
  // embeddable in non-ESM outputs.
  {
    entry: {
      "prop-form-schema": "src/designer/prop-form-schema.generated.ts",
    },
    format: ["esm"],
    target: "es2022",
    platform: "neutral",
    outDir: "dist",
    clean: false, // see above — the package `build` script cleans
    dts: true,
    sourcemap: true,
    splitting: false,
  },
])
