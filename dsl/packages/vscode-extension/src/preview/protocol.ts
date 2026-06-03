// The `sql-preview` custom-LSP wire contract, extension side.
//
// Mirrors `graph/protocol.ts`: the *types* are the single source of truth from
// `@flink-reactor/language-server` (imported type-only, so esbuild erases them
// — the heavy server module is NEVER pulled into the extension bundle). The
// method-name *strings* are re-declared here so importing them as runtime
// values never drags the server module in.
//
// SQL→DSL navigation reuses `flinkReactor/nodeRange` (node id → `Range`), the
// companion already shipped by `dag-visualization`; DSL→SQL uses
// `flinkReactor/nodeAtPosition` (caret position → node id). Live refresh
// piggybacks `flinkReactor/synthesized` — the same debounced signal the DAG
// panel listens to.

export const SYNTH_REQUEST = "flinkReactor/synth"
export const NODE_RANGE_REQUEST = "flinkReactor/nodeRange"
export const NODE_AT_POSITION_REQUEST = "flinkReactor/nodeAtPosition"
export const SYNTHESIZED_NOTIFICATION = "flinkReactor/synthesized"

export type {
  NodeAtPositionParams,
  NodeAtPositionResult,
  NodeRangeParams,
  NodeRangeResult,
  SynthesizedNotification,
  SynthFragment,
  SynthParams,
  SynthPipeline,
  SynthResponse,
  SynthStatementMeta,
  SynthStatementOrigin,
} from "@flink-reactor/language-server"
