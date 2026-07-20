// Public wire contract for the `tap-visualization` capability — the custom
// `flinkReactor/tapManifest` request the VS Code extension (and any LSP
// client) sends to read the active pipeline's tap layer.
//
// Everything here is plain JSON: the envelope mirrors the DSL's `TapManifest`
// shape (`pipelineName`, `flinkVersion`, `generatedAt`, `taps`) wrapped with
// `{ uri, version, ok, error?, consoleUrl? }`. Tap identity is the operator's
// `ConstructNode.id` — the same key the DAG model and the source-position map
// use — so the tap panel, the DAG overlay, and click-to-source all join on
// one identity. `connectorProperties` is deliberately absent (it can carry
// credentials and is not needed to render).

import type { DecodedTap } from "../synth/types.js"

export const TAP_MANIFEST_REQUEST = "flinkReactor/tapManifest"

export interface TapManifestParams {
  readonly uri: string
  /** The client's known document version (for logging/fallbacks only —
   *  the response always carries the server's synthesized version). */
  readonly version?: number
}

/** One tapped operator as rendered by the tap panel / DAG overlay. The shape
 *  is the worker's serializable projection — re-exported so the extension and
 *  its webview type against the same source of truth. */
export type TapView = DecodedTap

/** The `flinkReactor/tapManifest` response envelope. `ok: true` with empty
 *  `taps` is the valid "no operators tapped" state (`tapManifest === null`);
 *  `ok: false` + `error` means synthesis failed for the document. */
export interface TapManifestResponse {
  readonly uri: string
  readonly version: number
  readonly ok: boolean
  readonly error?: string
  readonly pipelineName?: string
  readonly flinkVersion?: string
  readonly generatedAt?: string
  /** The configured console push target (`flinkReactor.consoleUrl`),
   *  mirroring `fr synth --console-url`; omitted when unset — the panel then
   *  reports that no console is configured. */
  readonly consoleUrl?: string
  readonly taps: readonly TapView[]
}
