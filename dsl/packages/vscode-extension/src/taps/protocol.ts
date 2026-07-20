// The `tap-visualization` custom-LSP wire contract, extension side.
//
// The *types* are the single source of truth from `@flink-reactor/language-server`
// (re-exported type-only, so esbuild erases the import — the heavy server
// module is NEVER pulled into the extension bundle; the server runs as a
// separate process). The method-name *string* is tiny and re-declared here for
// the same reason: importing it as a runtime value would bundle the server.

export const TAP_MANIFEST_REQUEST = "flinkReactor/tapManifest"

export type {
  TapManifestParams,
  TapManifestResponse,
  TapView,
} from "@flink-reactor/language-server"
