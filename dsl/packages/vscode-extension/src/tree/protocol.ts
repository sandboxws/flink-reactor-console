// The `schema-navigation` custom-LSP wire contract, extension side.
//
// As with `graph/protocol.ts`: the *types* are the single source of truth from
// `@flink-reactor/language-server` (re-exported type-only so esbuild erases the
// import — the server module is never pulled into the extension bundle), while
// the method-name *string* is re-declared here so importing it as a runtime
// value cannot bundle the server. The synthesized notification reuses the
// `graph/protocol.ts` constant.

export const SCHEMA_TREE_REQUEST = "flinkReactor/schemaTree"

export type {
  SchemaTableInfo,
  SchemaTreeField,
  SchemaTreeLocation,
  SchemaTreeParams,
  SchemaTreeResponse,
  SchemaTreeWatermark,
} from "@flink-reactor/language-server"
