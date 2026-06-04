// Refresh-on-re-synthesis for inlay hints (schema-inlay-hints, Tier-3
// feature 10).
//
// Inlay hints are pull-based: the server must tell the client when cached
// hints went stale. The single source of "facts changed" is the Tier-0
// debounced re-synthesis — so the server signals `workspace/inlayHint/refresh`
// exactly once per completed synthesis (never per keystroke; the debounce
// already coalesced those). Per the LSP spec the request is only sent when the
// client declared `workspace.inlayHint.refreshSupport`; a failed send is
// swallowed — a missed refresh degrades to slightly stale hints until the next
// synthesis, never to an error.

export interface InlayHintRefresher {
  /** Call after each completed (stored) synthesis for a document. */
  onSynthesized(): void
}

export function createInlayHintRefresher(opts: {
  /** Did the client advertise `workspace.inlayHint.refreshSupport`? */
  readonly refreshSupported: () => boolean
  /** Sends `workspace/inlayHint/refresh` (e.g. `connection.languages.inlayHint.refresh`). */
  readonly send: () => Promise<unknown>
}): InlayHintRefresher {
  return {
    onSynthesized(): void {
      if (!opts.refreshSupported()) return
      void opts.send().catch(() => {
        // A client that rejects the refresh just keeps its cached hints until
        // it next pulls; nothing to surface.
      })
    },
  }
}
