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
- **Go-to-definition across references** — Ctrl/Cmd-click navigates FlinkReactor
  references: a **column** in an expression prop (`condition="user_id > 0"`)
  jumps to its `Schema({ fields })` field key — **including** when the schema
  lives in a `schemas/*.ts` module; a sink/source `catalog={lake}` jumps to the
  `…Catalog({ … })` that defines the handle; and a `<Join>`'s `left`/`right` (or
  a transform's `source`) jumps to the node it references. Misses fall through
  to the plain TypeScript definition handler.
- **Schema Explorer** — a **FlinkReactor** activity-bar view listing the active
  pipeline's **sources and sinks**, each expanding to its fields rendered
  `name: TYPE` with a 🔑 primary-key marker and a watermark child. Click a field
  to reveal its `Schema()` declaration (cross-file aware); click a source/sink
  to reveal its node JSX. It refreshes on the same debounced re-synthesis as the
  previews and degrades to non-navigable items rather than failing when a
  declaration can't be located.
- **Embedded SQL highlighting** — the Flink SQL you write inside `.tsx` props
  (`Filter` `condition`, `Map`/`Aggregate` projections, join `on`, `Query`
  clauses, `Validate` rules, `Schema` watermark, `RawSQL` body) is colored as
  SQL instead of rendering as one flat string — keywords, functions (`TUMBLE`,
  `CAST`, `CURRENT_WATERMARK`), type names, operators, literals, and comments
  each in their theme color. Two layers compose (see below); toggle with
  `flinkReactor.sql.highlighting`.
- **Schema inlay hints** — every component is annotated inline, after its
  opening tag, with the facts synthesis derived for it: the inferred **output
  schema** (`5 cols`, or an inline `[user_id, amount, ts]` in `compact` mode),
  its **changelog mode** (`append`/`retract`/`upsert`), and the resolved
  **effective parallelism** (`p=4` — the tooltip names which cascade level set
  it). Window nodes additionally show the injected `+window_start,
  +window_end` columns; joins show their merged output column count
  (`→ 6 cols`). Hover any schema hint to expand the full `column | TYPE` table
  — no command, no extra request. Hints update on the same debounced
  re-synthesis as diagnostics, disappear (rather than go stale) while an edit
  is mid-synthesis, and every part is independently toggleable via
  `flinkReactor.inlayHints.*`. TypeScript's own parameter/type inlay hints are
  untouched — the two sets compose.
- **Deep validation (SQL Gateway, opt-in)** — static checks can't see a real
  catalog. Enable `flinkReactor.gateway.*` and run **FlinkReactor: Deep
  Validate Pipeline** to submit the synthesized SQL to your Flink SQL Gateway
  via `EXPLAIN`: missing catalog tables, live type mismatches, and
  unregistered UDFs land as `FR-GATEWAY-` problems on the exact JSX element
  that produced the failing statement — rendered alongside (never replacing)
  the static diagnostics, each set clearing on its own cadence. Passes are
  explicit (command, or optionally on save), cancellable, cached by the
  generated SQL's hash, and fail soft: an unreachable gateway is one warning
  notice and a status-bar state, never a blocked editor. Off by default —
  nothing connects until you opt in.
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
| `FlinkReactor: Refresh Schema Explorer` | Re-request the schema tree for the active pipeline (also the view's title button) |
| `FlinkReactor: Deep Validate Pipeline (SQL Gateway)` | Run one opt-in deep-validation pass for the active pipeline against the configured SQL Gateway |

The three preview/DAG commands are also available as editor-title (navigation)
actions on any `.tsx` pipeline in a FlinkReactor project. The **Schema Explorer**
lives in the FlinkReactor activity-bar container and tracks the active pipeline
automatically.

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
| `flinkReactor/schemaTree` | request → `SchemaTreeResponse` | The active pipeline's sources/sinks as `{ tables: [{ nodeId, role, component, label, fields: [{ name, type, primaryKey, locationRef? }], watermark?, locationRef? }], ok, error? }` + the document version. Fields/PK/watermark are decoded in the synthesis worker; each `locationRef` (node JSX + per-source field-key positions, cross-file aware) is resolved host-side from the source-position map. Pure lookup-and-serialize. Powers the Schema Explorer. |

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

## Go-to-definition & Schema Explorer (IntelliJ supersession)

`textDocument/definition` is editor-agnostic LSP, so the navigation below also
benefits any other LSP client (IntelliJ, Neovim). It resolves three FlinkReactor
reference kinds, classified by where the cursor sits and resolved over the source
AST plus the held synthesis graph:

| Cursor on… | Resolves to | Cross-file |
|------------|-------------|------------|
| a **column** in an expression prop (`condition`, `on`, `Map` select, …) | the column's `Schema({ fields })` field key in the nearest upstream source | yes — follows the source's `schema={X}` import into `schemas/*.ts` |
| a sink/source `catalog={handle}` | the `…Catalog({ … })` call that defines the handle | follows a one-hop import |
| a `<Join>`'s `left`/`right`, a transform's `source` | the node bound to that variable | — |

Bare, back-quoted, and qualified `alias.column` references all resolve (the
alias maps to the matching join input). A computed handle, an untraceable
column, or a cursor on a SQL keyword returns **no result** (no error), so the
default TypeScript definition handler still runs.

This **supersedes and extends** the IntelliJ `schema-goto-definition`
(`intellij-tier-2-feature-9`), which covered only the column → `Schema`-field
case for IntelliJ. That same column case is now editor-agnostic LSP, joined by
catalog-handle and component-input navigation **and** the VS Code Schema
Explorer tree (fed by `flinkReactor/schemaTree`). `intellij-tier-2-feature-9`
should be archived/dropped now that this has landed.

## Embedded SQL highlighting (two layers, IntelliJ supersession)

The SQL embedded in pipeline props is colored by **two complementary layers**
over one shared SQL-context set (the DSL's `EXPRESSION_PROPS` plus the `RawSQL`
body and `Schema` watermark expression) and one Flink 1.20–2.2 vocabulary:

| Layer | Where | Character |
|-------|-------|-----------|
| **TextMate injection grammar** (`syntaxes/flinkreactor-sql.injection.json`, `injectTo: ["source.tsx"]`) | the VS Code shell | fast, **offline**, active the instant a file opens; heuristic (matches prop/component shapes textually) |
| **LSP semantic tokens** (`@flink-reactor/language-server`) | a separate process | **precise**, synthesis-aware: exact prop ranges from the parsed TSX + source-position map; **editor-agnostic** (also benefits IntelliJ/Neovim LSP clients) |

They compose the way VS Code intends: the grammar paints immediately, and the
server's **semantic tokens override it within the ranges the server reports**
(multi-line clause props, `RawSQL` bodies, watermark expressions inside a
`Schema({ … })` call, and only-FR props the textual grammar would mis-scope).
Outside those ranges — and before the server is ready, or on a transient server
failure — the grammar's coloring stands. Both layers map to **standard** SQL
scopes / LSP token types, so stock and custom themes color FR SQL with **zero**
per-user configuration, and unknown identifiers (columns, newer-version builtins)
are left plain — never colored as errors. Highlighting is best-effort on
malformed/mid-edit SQL: a half-typed `SELECT ` colors immediately, and the server
emits tokens even when synthesis fails, never blanking already-shown coloring.

`flinkReactor.sql.highlighting` selects the layers — `semantic+textmate`
(default), `textmate` (grammar only), `semantic` (server only), or `off` (plain
TypeScript strings). The server honors the setting exactly (it emits no SQL
tokens for `textmate`/`off`). VS Code cannot un-register a contributed grammar at
runtime, so for `semantic`/`off` the extension neutralizes the grammar's coloring
via a workspace `editor.tokenColorCustomizations` rule targeting an FR-only
marker scope (`meta.embedded.flinkreactor-sql`) — leaving standalone `.sql` files
untouched; switching back to a TextMate mode removes the rule.

This **supersedes** the IntelliJ `sql-injection` capability
(`intellij-tier-2-feature-5`), which used IntelliJ's platform-specific
`MultiHostInjector`. The precise layer is now editor-agnostic LSP; the grammar is
the VS Code packaging detail. `intellij-tier-2-feature-5` should be
archived/dropped for the VS Code/LSP stack now that this has landed.

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
| `flinkReactor.sql.highlighting` | `semantic+textmate` | Embedded-SQL coloring layers: `semantic+textmate` / `textmate` / `semantic` / `off` |
| `flinkReactor.inlayHints.enabled` | `true` | Master switch for synthesis-backed inlay hints |
| `flinkReactor.inlayHints.schema` | `count` | Schema fact: `off` / `count` (`5 cols`) / `compact` (inline column list) |
| `flinkReactor.inlayHints.changelogMode` | `true` | Show each node's changelog-mode badge |
| `flinkReactor.inlayHints.parallelism` | `true` | Show the resolved effective parallelism (`p=4`) |
| `flinkReactor.inlayHints.windowColumns` | `true` | Annotate windows with the injected `window_start`/`window_end` |
| `flinkReactor.inlayHints.joinColumns` | `true` | Annotate joins with their merged output column count |
| `flinkReactor.gateway.enabled` | `false` | Opt into SQL Gateway deep validation (nothing connects while off) |
| `flinkReactor.gateway.endpoint` | _(empty)_ | SQL Gateway base URL, e.g. `http://localhost:8083` |
| `flinkReactor.gateway.validateOnSave` | `false` | Also deep validate on save (never on keystrokes) |
| `flinkReactor.gateway.timeoutMs` | `30000` | Wall-clock budget (ms) per deep-validation pass |
| `flinkReactor.gateway.flinkVersion` | _(empty)_ | Optional gateway Flink-version hint (mismatch logs a warning only) |
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
