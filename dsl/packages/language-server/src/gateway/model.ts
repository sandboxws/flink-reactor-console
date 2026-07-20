// Wire contract for the gateway-validation capability (Tier-3 feature 11).
//
// One source of truth shared by the server and any LSP client (the VS Code
// shell mirrors these types): the explicit "deep validate" request and the
// gateway-state notification the client renders (e.g. in a status bar item).
// Deep validation is strictly opt-in (`flinkReactor.gateway.enabled`, default
// false) and explicitly triggered — this request plus an optional
// validate-on-save; never per keystroke.

/** Custom request: run one deep-validation pass for a document. */
export const DEEP_VALIDATE_REQUEST = "flinkReactor/deepValidate"

/** Notification: the gateway subsystem's current state, for client status UI. */
export const GATEWAY_STATE_NOTIFICATION = "flinkReactor/gatewayState"

export interface DeepValidateParams {
  readonly uri: string
}

/** Why a pass produced no gateway verdict. */
export type DeepValidateSkipReason =
  | "disabled" // flinkReactor.gateway.enabled is false
  | "misconfigured" // enabled but no endpoint
  | "no-synthesis" // nothing synthesized for the document (or synthesis failed)
  | "superseded" // a newer pass for the same document replaced this one

/** The outcome envelope `flinkReactor/deepValidate` resolves with. Failures
 *  are data, not RPC errors, so the client can render them gently. */
export interface DeepValidateResponse {
  readonly uri: string
  readonly status: "clean" | "errors" | "failed" | "skipped"
  /** Planner-error count when `status: "errors"`. */
  readonly errorCount?: number
  /** Set when `status: "skipped"`. */
  readonly skipReason?: DeepValidateSkipReason
  /** Human-readable failure description when `status: "failed"`
   *  (unreachable gateway, timeout, …). */
  readonly message?: string
  /** True when the verdict came from the SQL-hash cache (no EXPLAIN ran). */
  readonly fromCache?: boolean
}

/** Gateway subsystem states the client may surface. */
export type GatewayState = "disabled" | "idle" | "validating" | "error"

export interface GatewayStateNotification {
  readonly state: GatewayState
  /** Optional human-readable detail (e.g. the unreachable endpoint). */
  readonly message?: string
}
