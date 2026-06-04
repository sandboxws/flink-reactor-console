// ── FlinkReactor Node-only loader API ───────────────────────────────
// This entry point re-exports the DSL primitives that require a Node.js
// runtime (filesystem access + jiti module evaluation). It is the
// sibling of `src/browser.ts`: where `browser.ts` exposes the pure
// synthesis surface, `node.ts` exposes pipeline/config discovery and
// loading that reads `.tsx`/`.ts` files from disk.
//
// Consumers: the language server (`@flink-reactor/language-server`) and
// any other tool that needs to turn an on-disk pipeline into a
// `ConstructNode` without depending on the CLI bundle (`cli.js`).

export type {
  DiscoveredPipeline,
  ProjectContext,
} from "./cli/discovery.js"
export {
  discoverFromFile,
  discoverPipelines,
  loadConfig,
  loadEnvironment,
  loadPipeline,
  resolveProjectContext,
} from "./cli/discovery.js"
// ── SQL Gateway client ──────────────────────────────────────────────
// The REST transport behind `fr --deep-validate`, re-exported so the
// language server's gateway-validation capability submits EXPLAIN through
// the exact same path (and catches identical planner errors) instead of
// re-implementing HTTP. Network-bound, hence Node-entry-only.
export type { SqlGatewayClientOptions } from "./lib/sql-gateway/client.js"
export {
  SqlGatewayClient,
  SqlGatewayClientError,
  StatementExecutionError,
} from "./lib/sql-gateway/client.js"
export type {
  SessionConfig,
  StatementErrorDetail,
  StatementStatus,
} from "./lib/sql-gateway/types.js"
