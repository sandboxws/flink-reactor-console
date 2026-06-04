# @flink-reactor/language-server

Language Server Protocol (LSP) backend for [FlinkReactor](https://github.com/sandboxws/flink-reactor-dsl). It exposes the DSL's synthesis-backed intelligence — validation, source-position mapping, and the endpoint surface for completions/hover/code-actions/navigation — to any LSP-capable client (VS Code, IntelliJ, Neovim) from a single codebase.

This is the **Tier-0 foundation**: it stands up the server, the isolated synthesis pipeline, the source-position map, and the diagnostics wiring. The richer *behaviors* of completion, hover, code actions, etc. are supplied by the Tier-1+ capabilities that build on this server.

## Requirements

- **Node.js ≥ 20**
- **LSP protocol 3.17.x** (built on [`vscode-languageserver`](https://www.npmjs.com/package/vscode-languageserver) 9.x)

## How it works

```
open .tsx ──▶ debounce ──▶ IsolatedRunner (worker thread)
                              │  loadPipeline (jiti, @/ alias)  → ConstructNode
                              │  synthesizeApp + validators     → diagnostics, SQL, CRD
                              ▼
                         decoded result ──▶ source-position map (nodeId → Range)
                              │                       │
                              └────────────▶ FR-coded LSP diagnostics ──▶ client
```

- **Isolation.** Each synthesis runs in a worker thread with a configurable timeout and heap limit. A throwing, infinite-looping, or memory-hungry pipeline is terminated and the worker respawned — it degrades to a single diagnostic instead of crashing the server.
- **Caching.** Results are cached by a content hash of the document text + `flink-reactor.config.ts` mtime + resolved `@/` alias, so unchanged documents skip re-synthesis.
- **Source-position mapping.** ConstructNode IDs are mapped back to `.tsx` ranges by re-deriving each node's ID from the AST in `createElement` (post-order) order — mirroring the DSL's `generateNodeId`. A parity test gates this against real synthesis. Where prediction is ambiguous (computed props, programmatic `createElement`), the affected nodes are reported as a mismatch and their diagnostics fall back to the file top.
- **FR-only diagnostics.** Only `FR`-prefixed codes are emitted (`FR-SCHEMA-001`, `FR-EXPR-001`, `FR-CDC-001`, …); TypeScript type errors stay with `tsserver` / the ts-plugin, so the dual setup never duplicates diagnostics and nothing collides with the ts-plugin's nesting code (`90100`).

## Diagnostic codes

Every validation finding is projected to one LSP `Diagnostic` with `source: "flink-reactor"` and a stable `FR-{CATEGORY}-{NNN}` code derived **purely** from the finding's `category`. This table is the cross-editor source of truth — the VS Code, IntelliJ, and Neovim clients all read the same code for the same finding, so it filters and documents identically everywhere. Each category owns a reserved `…-0xx` range; the canonical code is listed below and the rest of each range is reserved for future sub-classification.

| Category | Code prefix | Canonical code | Severity | Surfaces |
|---|---|---|---|---|
| `schema` | `FR-SCHEMA-` | `FR-SCHEMA-001` | Error | Unknown column reference, with a did-you-mean suggestion from the upstream schema |
| `expression` | `FR-EXPR-` | `FR-EXPR-001` | Warning/Error | Malformed SQL in a `Filter`/`Map`/`Aggregate`/`Query` prop, narrowed to the prop value |
| `connector` | `FR-CONN-` | `FR-CONN-001` | Error/Warning | Missing required or conditional connector property (validator-chosen severity) |
| `changelog` | `FR-CDC-` | `FR-CDC-001` | Error | Retract/upsert source feeding an append-only sink — cross-node, with a `relatedInformation` link from sink to source |
| `structure` | `FR-DAG-` | `FR-DAG-001` | Error | Orphan source, dangling sink, or cycle (cycles list every participant as related information) |
| `sql` | `FR-SQL-` | `FR-SQL-001` | — | Reserved for generated-SQL verification (`gateway-validation`); not produced by static synthesis |

Severity is a total projection: the validator's `"error"` → `DiagnosticSeverity.Error`, `"warning"` → `DiagnosticSeverity.Warning` (no Information/Hint levels). Each diagnostic also stamps its structured `details` (did-you-mean candidate, `missingProps`, source/sink endpoints) onto `Diagnostic.data` so a later code-action capability can consume a stable shape.

## Hover (synthesis-backed)

`textDocument/hover` answers the **DSL-semantic** questions an author asks while
reading a pipeline — facts that only exist *after* synthesis — by reading the
shared per-document synthesis result rather than re-deriving anything:

| Hovered token | Card |
|---|---|
| a component **tag** (`<KafkaSource>`, `<Filter>`, incl. dot-notation `Route.Branch`) | kind + description, inferred **output schema** (`column │ Flink type`), **changelog mode** (append-only/retract/upsert), the **SQL fragment it emits** (sliced from the byte-span source map — `CREATE TABLE` for a source, `WHERE` for a `<Filter>`, `INSERT INTO … SELECT` for a sink), and its upstream/downstream **neighbors** |
| a **sink** tag | the tag card plus the sink's **accepted changelog modes** and whether the upstream mode is compatible |
| a connector **prop** (`topic`, `table`, …) | the prop's description, expected type, and default (curated connector-prop docs); SQL-expression props (`Filter.condition`, `Map.select`, …) are marked as such |
| a **column reference** inside an expression prop | the field's Flink type from the inferred **upstream** schema, or an explicit "unknown column" note (never a type for a SQL keyword/function/literal) |

### Relationship to the ts-plugin's plain-TS hover

The two hovers **compose, never duplicate**. The FR server answers only for
recognized FlinkReactor tags, connector props, and column references and returns
`null` for everything else, so the client falls back to `@flink-reactor/ts-plugin`'s
plain-TypeScript hover (the prop's TS type, JSDoc, import origin) inside
`tsserver`. The FR server owns the *semantic* layer (what schema/SQL a node
produces); the ts-plugin owns the *type* layer. Exactly one card shows for any
token.

### Source-position-map dependency & graceful degradation

Hover is the inverse of validation: validation maps a `nodeId` *to* a range;
hover maps a hovered position *back to* a node via the same source-position map,
then projects that node's synthesis facts. It never errors or blocks:

- **Node not in the position map** (programmatic `createElement`, ambiguous
  id-prediction, computed children) — falls back to a minimal **static card**
  (kind + description) for a recognizable tag, else `null` to defer to the
  ts-plugin.
- **Synthesis trailing the document version** (mid-edit, before the next
  debounced synth) — shows the static card with a **"synthesis pending"** note
  instead of possibly-stale types.

## Inlay hints (synthesis-backed)

`textDocument/inlayHint` renders each component's **synthesis-derived facts
inline**, after its opening tag — the bulk, always-visible counterpart to
hover's on-demand card. All facts are read from the per-document synthesis
state (`statementMeta` schemas, resolved changelog modes, the decoded effective
parallelism); a hint request never re-synthesizes.

| Hint part | Example | Where |
|---|---|---|
| inferred output schema | `5 cols` (`count`) or `[user_id, amount, ts]` (`compact`, width-bounded with a `N cols …` fallback) | every dataflow node with a resolvable output schema |
| changelog mode | `append` / `retract` / `upsert` | every node with a resolved mode |
| effective parallelism | `p=4` | every node (job-scoped; the tooltip names the resolving cascade level — Pipeline prop > env override > config > default) |
| injected window columns | `+window_start, +window_end` | `TumbleWindow`/`SlideWindow`/`SessionWindow` |
| merged join column count | `→ 6 cols` | `Join`/`TemporalJoin`/`LookupJoin`/`IntervalJoin`/`LateralJoin` |

Each part is an LSP **label part with its own Markdown tooltip**: hovering a
`5 cols` hint expands to the full `column | TYPE` schema with no follow-up
request (the tooltip is eager — the schema is already in hand). Parts are
independently toggleable via `flinkReactor.inlayHints.*`; the master toggle off
returns no hints at all. The `<Pipeline>` container and catalog declarations
are never annotated — their changelog entries are vacuous.

**Anchoring & the source-position map.** Hints anchor at each node's
opening-tag end via the same `nodeId → Range` map hover and diagnostics use
(the map records opening tags only, so multi-line tags anchor at their `/>`).
A node absent from the map — programmatic `createElement`, an aliased factory
call, ambiguous id-prediction — is simply skipped while its siblings still
annotate.

**Refresh model.** Inlay hints are pull-based; the server signals
`workspace/inlayHint/refresh` exactly once per completed **debounced**
re-synthesis (never per keystroke), and only when the client declared
`workspace.inlayHint.refreshSupport`. Between an edit and the next synthesis
the provider answers **empty** rather than stale: when the stored result's
version trails the document version there is nothing trustworthy to show, and
the refresh re-pulls the moment it catches up. A failed synthesis likewise
yields no hints — absence over wrong facts, and never an error.

## Usage

### As a standalone binary (stdio)

LSP clients spawn the binary and speak LSP over stdin/stdout:

```bash
flink-reactor-lsp
```

### Embedded in-process

Clients that host the server in-process build a connection over a message channel and hand it to `createServer`:

```ts
import { createServer } from "@flink-reactor/language-server"
import { createConnection } from "vscode-languageserver/node"

const connection = createConnection(/* reader */, /* writer */)
const handle = createServer(connection)
// ...later: await handle.dispose()
```

## Configuration

Settings are forwarded by the client under the `flinkReactor.*` namespace (via `initializationOptions` or `workspace/didChangeConfiguration`):

| Setting | Default | Description |
|---|---|---|
| `flinkReactor.enable` | `true` | Master switch; when `false` no diagnostics are published. |
| `flinkReactor.debounce` | `300` | Milliseconds to wait after the last edit before re-synthesizing. |
| `flinkReactor.timeout` | `8000` | Per-synthesis isolation timeout (ms) for a warm worker. |
| `flinkReactor.bootGraceMs` | `20000` | Budget for a fresh worker's first synthesis (thread boot + first project-DSL import). |
| `flinkReactor.maxHeapMb` | `512` | Worker heap ceiling (MB). |
| `flinkReactor.flinkVersion` | DSL default | Target Flink version (`1.20`–`2.2`). |
| `flinkReactor.inlayHints.enabled` | `true` | Master switch for synthesis-backed inlay hints. |
| `flinkReactor.inlayHints.schema` | `count` | Schema fact rendering: `off`, `count` (`5 cols`), or `compact` (inline column list, width-bounded). |
| `flinkReactor.inlayHints.changelogMode` | `true` | Show the changelog-mode badge. |
| `flinkReactor.inlayHints.parallelism` | `true` | Show the effective-parallelism label. |
| `flinkReactor.inlayHints.windowColumns` | `true` | Annotate window nodes with the injected `window_start`/`window_end`. |
| `flinkReactor.inlayHints.joinColumns` | `true` | Annotate join nodes with the merged output column count. |

## Development

```bash
pnpm build      # bundle dist/server.js + dist/worker.js (tsup, ESM)
pnpm test       # unit + integration tests (vitest)
pnpm typecheck  # tsc --noEmit
```
