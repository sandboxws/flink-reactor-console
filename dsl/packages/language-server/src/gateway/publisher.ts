// Dual-channel diagnostic publishing (gateway-validation, Tier-3 feature 11).
//
// LSP's `textDocument/publishDiagnostics` REPLACES a document's whole set, so
// "separate channels" must be composed server-side: the static (Tier-1) set
// and the gateway set are stored independently per document and every publish
// sends their concatenation. A static re-synthesis replaces only the static
// half; a gateway pass (or clear) replaces only the gateway half — neither
// ever clears the other, which is the central correction over the superseded
// IntelliJ design's shared channel.

import type { Diagnostic } from "vscode-languageserver"

export class DualChannelDiagnostics {
  private readonly staticSets = new Map<string, readonly Diagnostic[]>()
  private readonly gatewaySets = new Map<string, readonly Diagnostic[]>()

  constructor(
    private readonly send: (uri: string, diagnostics: Diagnostic[]) => void,
  ) {}

  /** Replace the static half (each debounced synthesis) and publish. */
  setStatic(uri: string, diagnostics: readonly Diagnostic[]): void {
    this.staticSets.set(uri, diagnostics)
    this.publish(uri)
  }

  /** Replace the gateway half (each completed pass) and publish. */
  setGateway(uri: string, diagnostics: readonly Diagnostic[]): void {
    this.gatewaySets.set(uri, diagnostics)
    this.publish(uri)
  }

  /** Clear only the gateway half (clean pass, disable, gateway drop). */
  clearGateway(uri: string): void {
    if (!this.gatewaySets.has(uri)) return
    this.gatewaySets.delete(uri)
    this.publish(uri)
  }

  /** Clear the gateway half of every document (gateway disabled/dropped). */
  clearAllGateway(): void {
    const uris = [...this.gatewaySets.keys()]
    this.gatewaySets.clear()
    for (const uri of uris) this.publish(uri)
  }

  /** Document closed: drop both halves and clear client-side. */
  forget(uri: string): void {
    this.staticSets.delete(uri)
    this.gatewaySets.delete(uri)
    this.send(uri, [])
  }

  gatewayCount(uri: string): number {
    return this.gatewaySets.get(uri)?.length ?? 0
  }

  private publish(uri: string): void {
    this.send(uri, [
      ...(this.staticSets.get(uri) ?? []),
      ...(this.gatewaySets.get(uri) ?? []),
    ])
  }
}
