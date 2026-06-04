// The `flinkReactor/tapManifest` projector (tap-visualization, Tier-3
// feature 13).
//
// A pure projection of the held per-document synthesis state: the worker
// already decoded `tapManifest` (schema normalized, `autoTap` stamped,
// `connectorProperties` dropped), so this builder only wraps it in the
// response envelope. The three states:
//
//   • synthesis ok, taps present → `ok: true` + the manifest fields + `taps`
//   • synthesis ok, `tapManifest === null` → `ok: true` + `taps: []` — the
//     valid "no operators tapped" state, never an error
//   • synthesis failed → `ok: false` + `error`, `taps: []` — the panel keeps
//     its last good view dimmed
//
// `consoleUrl` comes from the forwarded `flinkReactor.consoleUrl`
// configuration (mirroring the CLI `fr synth --console-url`), not from the
// manifest — pushing is a runtime concern the manifest does not record.

import type { DocumentSynthState } from "../document-state.js"
import type { TapManifestResponse } from "../taps/model.js"

export function buildTapManifestModel(
  state: DocumentSynthState | undefined,
  uri: string,
  fallbackVersion: number,
  consoleUrl: string | undefined,
): TapManifestResponse {
  if (!state) {
    return {
      uri,
      version: fallbackVersion,
      ok: false,
      error: "Pipeline has not been synthesized yet.",
      taps: [],
    }
  }

  const { result, version } = state
  if (!result.ok) {
    return {
      uri,
      version,
      ok: false,
      error: result.loadError?.message ?? "Synthesis failed.",
      taps: [],
    }
  }

  const manifest = result.tapManifest
  if (!manifest) {
    // No operators tapped — a valid, healthy state (`tapManifest === null`).
    return {
      uri,
      version,
      ok: true,
      ...(consoleUrl !== undefined ? { consoleUrl } : {}),
      taps: [],
    }
  }

  return {
    uri,
    version,
    ok: true,
    pipelineName: manifest.pipelineName,
    flinkVersion: manifest.flinkVersion,
    generatedAt: manifest.generatedAt,
    ...(consoleUrl !== undefined ? { consoleUrl } : {}),
    taps: manifest.taps,
  }
}
