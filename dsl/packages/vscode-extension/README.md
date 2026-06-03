# FlinkReactor for VS Code

Editor support for [FlinkReactor](https://flink-reactor.dev) — the React-style
TSX DSL that synthesizes to Flink SQL and Kubernetes `FlinkDeployment` CRDs.

This extension is the **client shell**: it brings FlinkReactor's semantic layer
into VS Code and automates the setup that otherwise blocks the editor tooling.

## Features

- **Live diagnostics** — the `@flink-reactor/language-server` synthesizes your
  `pipelines/*/index.tsx` in the background and publishes `FR`-prefixed problems
  (schema typos, orphaned sources, invalid connectors, changelog-mode
  mismatches) inline, with no terminal round-trip.
- **One-click ts-plugin setup** — adds `@flink-reactor/ts-plugin` to your
  `tsconfig.json` (comment-preserving, undoable) so JSX-nesting checks and
  ranked completions light up inside `tsserver`.
- **Workspace TypeScript prompt** — offers to switch VS Code onto your project's
  TypeScript, which the ts-plugin requires to load.
- **Project awareness** — discovers the nearest `flink-reactor.config.ts`, the
  `@/` alias, and your pipelines.
- **SQL preview & DAG** — open a read-only, live **SQL Preview** (or the
  **Pipeline DAG**) beside the editor. The SQL preview maps **both ways**:
  move the caret onto a node in the `.tsx` and it highlights the statements and
  the exact byte-spans that node produced (e.g. a `<Filter>`'s `WHERE`
  predicate); click a SQL span and it jumps back to the node that authored it.
  It refreshes on the same debounced re-synthesis as diagnostics and keeps the
  last good SQL behind a "stale" banner when an edit breaks synthesis.
- **CRD preview** — open a read-only, tabbed **CRD Preview** beside the editor
  showing the full generated Kubernetes artifact set for the active pipeline,
  one syntax-highlighted YAML tab per artifact. A **standard SQL pipeline**
  shows a `FlinkDeployment` (or `FlinkBlueGreenDeployment`) + the wrapping
  `ConfigMap`; a **Flink CDC pipeline-connector pipeline** (e.g.
  `PostgresCdcPipelineSource`) instead shows the Flink CDC `pipeline.yaml` +
  `configmap.yaml` — the header labels which set applies so you always know why
  a `FlinkDeployment` tab is or is not present. Copy any artifact, or **Save to
  dist/** (one artifact or the whole set) to land exactly where `fr synth`
  writes. Like the SQL preview, it refreshes on debounced re-synthesis and keeps
  the last-good artifacts behind a "stale" banner when an edit breaks synthesis.
- **Editor surface** — a status bar item, an output channel, a Getting Started
  walkthrough, and starter snippets (`frpipeline`, `frsource`, `frsink`,
  `frtransform`, `frschema`).

## The two-server model

A FlinkReactor `.tsx` file is served by **two** language services at once, with
no overlap by construction:

| Server | Runs in | Owns |
|--------|---------|------|
| **`tsserver` + `@flink-reactor/ts-plugin`** | TypeScript's language service | JSX nesting validity (code `90100`), context-aware completions, type errors |
| **`@flink-reactor/language-server`** | a separate Node process (this extension is its LSP client) | synthesis-backed diagnostics — every `FR`-prefixed code |

The ts-plugin only activates when (1) it is listed in `tsconfig.json` **and**
(2) VS Code uses your **workspace** TypeScript — the bundled VS Code TypeScript
refuses workspace plugins for security. This extension automates both.

## Getting started

1. Open a FlinkReactor project (one containing `flink-reactor.config.ts`).
2. Run **FlinkReactor: Configure ts-plugin in tsconfig.json** (or accept the
   prompt).
3. Run **FlinkReactor: Use Workspace TypeScript Version** and reload.
4. Open a `pipelines/<name>/index.tsx` and start editing.

## Commands

| Command | Description |
|---------|-------------|
| `FlinkReactor: Configure ts-plugin in tsconfig.json` | Ensure the ts-plugin, `jsxImportSource`, and `jsx` are set |
| `FlinkReactor: Use Workspace TypeScript Version` | Set `typescript.tsdk` to the workspace TypeScript and reload |
| `FlinkReactor: Restart Language Server` | Restart the synthesis language server |
| `FlinkReactor: Show Output` | Open the FlinkReactor output channel |
| `FlinkReactor: Show SQL Preview` | Open the read-only, bidirectional SQL preview beside a pipeline |
| `FlinkReactor: Open Pipeline DAG` | Open the pipeline dataflow graph beside a pipeline |
| `FlinkReactor: Open CRD Preview` | Open the read-only, tabbed Kubernetes artifact-set preview beside a pipeline |

The last three are also available as editor-title (navigation) actions on any
`.tsx` pipeline in a FlinkReactor project.

## Custom LSP requests

The webview panels never re-synthesize or re-emit SQL — they **project** the
synthesis result the language server already holds for the active document
version. The server exposes it over these custom requests/notifications (shared
type contract re-exported from `@flink-reactor/language-server`):

| Method | Direction | Purpose |
|--------|-----------|---------|
| `flinkReactor/synth` | request → `SynthResponse` | The cached per-pipeline `{ statements, statementOrigins, statementContributors, statementMeta }` (number-keyed maps as `[index, value]` entry arrays) + the document version. Pure lookup-and-serialize — never runs synthesis. Powers the SQL preview. |
| `flinkReactor/nodeRange` | request → `Range \| null` | Resolve a node id to its `.tsx` source range. The SQL→DSL "reveal in source" companion (the spec's `locateNode`); shared with the DAG panel. |
| `flinkReactor/nodeAtPosition` | request → `nodeId \| null` | The inverse — resolve a caret position to the innermost node under it. Drives DSL→SQL highlighting from the editor caret. |
| `flinkReactor/synthesized` | server notification | Fired after each debounced re-synthesis so an open panel re-requests a fresh model (no second client-side debounce). |
| `flinkReactor/graphModel` | request → `GraphModelResponse` | The DAG projection (the `dag-visualization` capability). |
| `flinkReactor/crdPreview` | request → `CrdPreviewResponse` | The per-pipeline Kubernetes artifact set (`{ pipelineName, pipelineKind, status, artifacts: [{ id, label, filename, kind, yaml }] }` + the document version). The CRD YAML is serialized in the synthesis worker (via the browser-safe `toYaml`); the request is a pure lookup-and-serialize. Powers the CRD preview. |

## CRD preview: standard vs. CDC, and the IntelliJ supersession

A FlinkReactor pipeline synthesizes to a *set* of Kubernetes artifacts, and the
shape depends on the source:

| Pipeline kind | Artifacts (one tab each) | `dist/<pipeline>/` files |
|---------------|--------------------------|--------------------------|
| **Standard SQL** | `FlinkDeployment` (or `FlinkBlueGreenDeployment`) + wrapping `ConfigMap` | `deployment.yaml`, `configmap.yaml` |
| **Flink CDC pipeline-connector** (e.g. `PostgresCdcPipelineSource`) | Flink CDC `pipeline.yaml` + `configmap.yaml` (no `FlinkDeployment`) | `pipeline.yaml`, `configmap.yaml` |

Either shape may carry extra **secondary resources** (ConfigMaps,
ServiceAccounts), each shown as its own tab. The header labels which set applies
— driven by the server-authoritative `pipelineKind` — so you are never left
wondering why a `FlinkDeployment` tab is or is not present. **Save to dist/**
writes each artifact to `dist/<pipeline>/<filename>`, mirroring `fr synth`
exactly, so the preview's save and the CLI are interchangeable.

This **supersedes** the IntelliJ `crd-preview` tool window (`intellij-tier-2-feature-7`),
which predated the multi-artifact reality: it rendered a *single* CRD document
with a diff view and a CRD-only request. This VS Code preview reuses the
`flinkReactor/crdPreview` request name but returns the **full** artifact set;
the IntelliJ diff view is not carried forward in v1 (live re-synthesis covers
the primary "see the effect of my edit" need).

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `flinkReactor.enable` | `true` | Master switch for the language server |
| `flinkReactor.diagnostics.enable` | `true` | Publish synthesis-backed diagnostics |
| `flinkReactor.server.debounce` | `300` | Debounce (ms) after the last edit before re-synthesizing |
| `flinkReactor.server.timeout` | `5000` | Per-synthesis isolation timeout (ms) |
| `flinkReactor.server.maxHeapMb` | `512` | Heap ceiling (MB) for the synthesis worker |
| `flinkReactor.flinkVersion` | _(unset)_ | Target Flink version override |
| `flinkReactor.tsPlugin.autoConfigure` | `prompt` | `prompt` / `always` / `never` for tsconfig editing |
| `flinkReactor.cliPath` | _(empty)_ | Path to the `flink-reactor` CLI (reserved for CLI integration) |

## Packaging

The `.vsix` is self-contained: the extension host is bundled with esbuild
(`dist/extension.js`), and the language server is vendored under `server/` by
`scripts/prepare-server.mjs`. At runtime the extension prefers the server install
in your project's `node_modules` (so diagnostics match the DSL version your
project depends on) and falls back to the bundled copy.

```bash
pnpm build           # bundle the extension host
pnpm prepare-server  # vendor the language server into server/
pnpm package         # produce a .vsix (vsce --no-dependencies)
pnpm test            # unit tests (vitest)
pnpm test:e2e        # @vscode/test-electron end-to-end suite
```

## License

BSL-1.1 — see [LICENSE](./LICENSE).
