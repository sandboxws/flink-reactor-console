// The gateway-validation custom-LSP wire contract, extension side.
//
// The *types* are the single source of truth from `@flink-reactor/language-server`
// (re-exported type-only, so esbuild erases the import — the heavy server
// module is NEVER pulled into the extension bundle; the server runs as a
// separate process). The method-name *strings* are tiny and re-declared here
// for the same reason: importing them as runtime values would bundle the server.

export const DEEP_VALIDATE_REQUEST = "flinkReactor/deepValidate"
export const GATEWAY_STATE_NOTIFICATION = "flinkReactor/gatewayState"

export type {
  DeepValidateParams,
  DeepValidateResponse,
  DeepValidateSkipReason,
  GatewayState,
  GatewayStateNotification,
} from "@flink-reactor/language-server"
