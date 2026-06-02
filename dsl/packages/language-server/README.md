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
- **FR-only diagnostics.** Only `FR`-prefixed codes are emitted (`FR-SCHEMA`, `FR-EXPRESSION`, `FR-CONNECTOR`, …); TypeScript type errors stay with `tsserver` / the ts-plugin, so the dual setup never duplicates diagnostics.

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
| `flinkReactor.timeout` | `5000` | Per-synthesis isolation timeout (ms). |
| `flinkReactor.maxHeapMb` | `512` | Worker heap ceiling (MB). |
| `flinkReactor.flinkVersion` | DSL default | Target Flink version (`1.20`–`2.2`). |

## Development

```bash
pnpm build      # bundle dist/server.js + dist/worker.js (tsup, ESM)
pnpm test       # unit + integration tests (vitest)
pnpm typecheck  # tsc --noEmit
```
