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
| `FlinkReactor: Open Pipeline Designer` | Open the low-code visual designer (palette + canvas + prop forms) beside a pipeline |
| `FlinkReactor: Synth / Validate / Graph / Schema / Deploy / Up / Down / Status / Stop Job / Resume Job / Savepoint / Doctor` | Run the corresponding `flink-reactor` CLI verb as a VS Code task (see *CLI lifecycle*) |
| `FlinkReactor: Dev (watch mode)` | Start `flink-reactor dev` as the single managed watch task (re-invoking reveals it) |
| `FlinkReactor: Stop Dev` | Stop the managed dev watch (also the dev status bar item's click action) |
| `FlinkReactor: Select Environment` | Pick the active environment; subsequent commands run with `--env <selected>` |

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
| `flinkReactor/designerModel` | request → `DesignerModelResponse` | The graph model **plus** per-node prop editability (`editable` literal with value + range vs `readOnly` computed/identifier/spread, classified from the `.tsx` AST) and the document's file kind (`arbitrary` / `designer-managed` / `pragma-violated`) for the edit-safety matrix. Powers the visual designer canvas + prop forms. |
| `flinkReactor/applyDesignerEdit` | request → `ApplyDesignerEditResponse` | The designer's single write path: scalar literal-prop edits, pragma-gated structural edits (add/delete/re-parent/add-join), and greenfield generation — applied with `ts-morph`, verified (re-parse + re-synthesize) before commit, returned as text edits the extension applies as one undoable `WorkspaceEdit` (or `newFileContent` for generation). Refusals are data (`refusedReason`), never RPC errors. |

## Test Explorer: pipeline tests, SQL golden diffs, snapshot blessing

The project's regression net is its Vitest pipeline tests
(`tests/pipelines/<name>.test.ts`, per the template contract: synthesize the
pipeline and `expect(sql).toMatchSnapshot()` plus load-bearing
`expect(sql).toMatch(...)` checks). The **FlinkReactor Pipeline Tests**
controller wires them into VS Code's native Test Explorer — net-new, with no
IntelliJ analog:

- **Discovery** is filesystem-based (works before Vitest is even installed):
  every `tests/pipelines/*.test.ts` groups under its pipeline, with
  `describe`/`it` children carrying source ranges (driving the native gutter
  run-controls) and snapshot/SQL-snapshot tags. A watcher re-discovers on
  create/delete/change. A run/debug CodeLens row also appears in open test
  files.
- **Run/Debug** shell out to the *project's* Vitest (`node_modules`; never a
  bundled copy) with `--reporter=json --outputFile=…` as the source of truth
  (a default reporter streams to the *FlinkReactor Pipeline Tests* output
  channel). Outcomes, durations, and failures map back to each test by file +
  full title; dynamically-titled tests surface as synthetic children so no
  result is lost. Failures attach inline messages at the failing assertion's
  line, with expected/actual where recoverable.
- **SQL golden diff**: a failed *SQL* snapshot opens as a readable
  side-by-side diff — stored (expected) vs freshly generated (received) SQL —
  over two read-only virtual `.sql` documents in the native diff editor.
  Reachable from the inline failure message and the Test Explorer context
  menu (`Open SQL Snapshot Golden Diff`). Non-SQL snapshot mismatches (e.g.
  CRD objects) and plain assertion failures stay inline.
- **Update snapshots**: per-test/per-file (Test Explorer context menu) and
  project-wide (`FlinkReactor: Update Pipeline Snapshots`) actions wrap
  `vitest --update`, scoped via file + `-t`; the update run's outcomes flip
  the tree to passing and any open golden diff for an updated test closes.
  Updates only ever run on explicit action — never during a normal run or
  watch.
- **Watch**: the Test Explorer's continuous-run toggle starts a single
  `vitest --watch --reporter=json` per workspace, feeding incremental results
  into a long-lived run until stopped.
- **Graceful degradation**: no `tests/pipelines/` → an empty tree, no error;
  Vitest missing → discovery still lists files and a run reports each test
  `errored` with an actionable message; unparseable Vitest output → the run
  errors with the reason instead of crashing.

## CLI lifecycle: tasks, CodeLens, Problems panel, environments, fr dev

The `flink-reactor` CLI remains the project's lifecycle surface (artifacts on
disk, deployment, cluster control); this extension brings it into the editor
without modifying it. Every wrapped command runs through VS Code's **task
system** — the exact command line is visible, the run is cancelable, the exit
code is surfaced (a non-zero exit notifies and logs to the `FlinkReactor`
output channel), and a stable task identity (verb + pipeline + env) reuses one
terminal per command.

**Binary resolution** (never a silent no-op): the workspace
`node_modules/.bin/flink-reactor` (the version-pinned dev dependency) →
the `flinkReactor.cliPath` setting → `PATH`. When none resolve, the command
short-circuits with an actionable error instead of spawning anything.

**Per-pipeline CodeLens**: every `pipelines/<name>/index.tsx` gets a lens row —
`▶ Synth · Validate · Graph · Deploy · Run tests` — each scoped to that
pipeline (`-p <name>` derived from the path, no prompting). "Run tests" runs
the project's Vitest against the conventional `tests/pipelines/<name>.test.ts`.
Component/schema files get no lens.

**Problems panel**: CLI tasks attach the `$flink-reactor` problem matcher,
which parses machine-oriented diagnostic lines
(`<file>:<line>:<col> <severity> FR-<code> <message>`) into navigable Problems
entries that clear on a clean re-run. It applies only to FlinkReactor CLI
tasks and never duplicates the language server's live editor diagnostics
(different sources, different lifecycles). Human-readable CLI output passes
through as plain terminal text.

**Environment switcher**: the `$(globe) env:` status bar item /
`FlinkReactor: Select Environment` quick-picks among the environments
discovered from `flink-reactor.config.ts`; the selection persists per
workspace and scopes subsequent commands via `--env <selected>`. With no
selection, commands run without `--env` (the CLI's own default applies).

**Managed `fr dev`**: one watch task per workspace — re-invoking *reveals* the
running task instead of starting a second; a status bar item shows it is
running and stops it on click; status clears when the task exits.

## Visual designer: what is editable, and what is refused

The **Pipeline Designer** (`FlinkReactor: Open Pipeline Designer`) is a webview
canvas with a component palette (the DSL inventory grouped by kind,
drop-validity from the ts-plugin hierarchy rules) and prop forms generated from
the DSL's typed prop interfaces (string-literal unions render as dropdowns,
required markers honor both `readonly x:` optionality and `requireProps(...)`,
JSDoc renders as field help).

A FlinkReactor pipeline is arbitrary TypeScript: the canvas shows **resolved**
values, while the file stores **expressions** (`format={WIRE_FORMAT[input]}`).
There is no general inverse from a resolved value back to its expression, so
**full round-trip of arbitrary pipelines is explicitly out of scope** — the
designer degrades to read-only rather than guess. Every write is gated by the
**edit-safety matrix** and applied server-side via a `ts-morph` codemod under a
verify-then-commit rule: the edited text is re-parsed and re-synthesized
*before* it is committed, and a change that does not round-trip cleanly is
rolled back. Committed changes land as a normal undoable `WorkspaceEdit`; the
`.tsx` stays the source of truth and the canvas always re-renders from the
fresh synthesis (external text edits refresh it too).

| Edit kind | Arbitrary `.tsx` | Designer-managed `.tsx` (`// @flink-reactor designer`) |
|---|---|---|
| Open / read-only view | SAFE | SAFE |
| Scalar edit of an `editable` (literal) prop | SAFE | SAFE |
| Scalar edit of a `readOnly` (computed/identifier/spread) prop | REFUSED — "Edit in source" | REFUSED — same |
| Add / delete / re-parent / add-join | REFUSED | SAFE (hierarchy-rule checked) |
| Free wiring | REFUSED | SAFE within hierarchy rules |
| Regenerate the whole file from the canvas | REFUSED | n/a (greenfield writes a *new* file) |

The `// @flink-reactor designer` pragma asserts a file is a fully static
subset (no loops, conditionals, computed props, or spreads — bare identifier
references like `schema={OrdersSchema}` are fine). The claim is **checked, not
trusted**: the server re-verifies the contract before every structural edit and
refuses (with the specific violation) when a hand edit broke it. The
"New pipeline…" draft mode composes a fresh static `.tsx` from the palette and
generates a deterministic file that carries the pragma, so generated pipelines
remain structurally editable.

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
