// The `dag-visualization` custom-LSP wire contract, extension side.
//
// The *types* are the single source of truth from `@flink-reactor/language-server`
// (re-exported type-only, so esbuild erases the import — the heavy server
// module is NEVER pulled into the extension bundle; the server runs as a
// separate process). The method-name *strings* are tiny and re-declared here
// for the same reason: importing them as runtime values would bundle the server.

export const GRAPH_MODEL_REQUEST = "flinkReactor/graphModel"
export const NODE_RANGE_REQUEST = "flinkReactor/nodeRange"
export const SYNTHESIZED_NOTIFICATION = "flinkReactor/synthesized"

export type {
  GraphModelColumn,
  GraphModelDiagnostic,
  GraphModelEdge,
  GraphModelNode,
  GraphModelParams,
  GraphModelResponse,
  NodeRangeParams,
  NodeRangeResult,
  SynthesizedNotification,
} from "@flink-reactor/language-server"
