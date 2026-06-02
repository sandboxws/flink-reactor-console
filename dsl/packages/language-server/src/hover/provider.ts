// Synthesis-backed `textDocument/hover` behavior.
//
// Pipeline: classify the token under the cursor (current text) → recognize it as
// a FlinkReactor token → resolve it to a node (synthesis result for the doc
// version) → dispatch to the matching card builder. Layered fallback: a
// recognized tag whose node is absent from the position map degrades to a
// minimal static card; an unrecognized token returns `null` so the client shows
// the ts-plugin's plain-TS hover. Never throws.

import { type Hover, MarkupKind } from "vscode-languageserver"
import type { DocumentSynthState } from "../document-state.js"
import type { SourceRange } from "../synth/types.js"
import {
  buildColumnRefCard,
  buildPropCard,
  buildSinkCard,
  buildStaticCard,
  buildTagCard,
} from "./cards.js"
import { classifyToken } from "./classify.js"
import { isDocumentedComponent } from "./component-docs.js"
import { HoverFacts } from "./facts.js"
import { type Position, resolveNodeAt } from "./resolve.js"

const PENDING_NOTE =
  "_⏳ synthesis pending — schema, types, and SQL will appear once it catches up._"

export interface HoverRequest {
  /** Shared synthesis state for the document (undefined before the first synth). */
  readonly state: DocumentSynthState | undefined
  /** Current document text (classification runs against this, not the synth-time text). */
  readonly sourceText: string
  readonly fileName: string
  readonly position: Position
  /** Current document version — compared to the synth state's to detect staleness. */
  readonly documentVersion: number
}

/**
 * Produce the FlinkReactor hover for a position, or `null` to defer to the
 * ts-plugin. Pure and total: any unexpected condition degrades to `null`.
 */
export function provideHover(req: HoverRequest): Hover | null {
  let token: ReturnType<typeof classifyToken>
  try {
    token = classifyToken(req.sourceText, req.fileName, req.position)
  } catch {
    return null // a parse hiccup must never break hover
  }
  if (!token) return null // not an FR tag/prop/column-ref → ts-plugin answers

  const { state } = req
  if (!isRecognized(token.tag, state)) return null

  // Connector-prop docs are static (curated table + expression detection) — they
  // render even while synthesis is pending.
  if (token.kind === "prop") {
    const card = buildPropCard(token.tag, token.prop)
    return card ? toHover(card, token.range) : null
  }

  const pending = !state || state.version !== req.documentVersion
  const facts = state ? new HoverFacts(state.result) : undefined
  const resolved = state
    ? resolveNodeAt(state.positionMap, req.position)
    : undefined
  const live = !pending && !!facts?.ok && !!resolved

  if (token.kind === "column-ref") {
    if (live && facts && resolved)
      return toHover(
        buildColumnRefCard(facts, resolved.nodeId, token.ident),
        token.range,
      )
    return toHover(`**\`${token.ident}\`**\n\n${PENDING_NOTE}`, token.range)
  }

  // token.kind === "tag"
  if (live && facts && resolved) {
    const info = facts.getNodeInfo(resolved.nodeId)
    const card =
      info?.kind === "Sink"
        ? buildSinkCard(facts, resolved.nodeId)
        : buildTagCard(facts, resolved.nodeId)
    return toHover(card, token.range)
  }

  // Recognized tag, but no live node (programmatic createElement, ambiguous
  // id-prediction, or stale/failed synthesis) → minimal static card.
  let card = buildStaticCard(token.tag, componentKind(token.tag, state))
  if (pending) card += `\n\n${PENDING_NOTE}`
  return toHover(card, token.range)
}

// ── helpers ─────────────────────────────────────────────────────────

/** Is `tag` a recognized FlinkReactor component? True when synthesis produced a
 *  node of that component in this document, or when it (or its dot-notation
 *  base) is a documented component. */
function isRecognized(
  tag: string,
  state: DocumentSynthState | undefined,
): boolean {
  if (state?.result.nodes.some((n) => n.component === tag)) return true
  if (isDocumentedComponent(tag)) return true
  const base = tag.split(".")[0]
  return base !== tag && isDocumentedComponent(base)
}

/** The kind for a component as seen in this document's synthesis, if any. */
function componentKind(
  tag: string,
  state: DocumentSynthState | undefined,
): string | undefined {
  return state?.result.nodes.find((n) => n.component === tag)?.kind
}

/** `SourceRange` is structurally an LSP `Range` (0-based line/character). */
function toHover(value: string, range: SourceRange): Hover {
  return { contents: { kind: MarkupKind.Markdown, value }, range }
}
