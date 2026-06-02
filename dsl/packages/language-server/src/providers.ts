import type {
  CodeAction,
  CompletionItem,
  CompletionList,
  DocumentSymbol,
  Hover,
  InlayHint,
  LocationLink,
  SemanticTokens,
} from "vscode-languageserver"
import type { Connection } from "vscode-languageserver/node"
import type { DocumentStateStore } from "./document-state.js"

/**
 * Register thin dispatchers for every provider endpoint the server advertises.
 *
 * Tier-0 wires the endpoints and returns neutral/empty results so the dual
 * tsserver + LSP setup never errors; the *behavior* of each endpoint is
 * supplied by Tier-1+ changes, which read the shared per-document synthesis
 * state from `store` (so all providers see the same result + source map for a
 * given document version).
 */
export function registerProviders(
  connection: Connection,
  store: DocumentStateStore,
): void {
  const empty = <T>(value: T) => value

  connection.onCompletion((params): CompletionList => {
    // Tier-1 ranked completions read `store.get(params.textDocument.uri)`.
    void store.get(params.textDocument.uri)
    return { isIncomplete: false, items: [] }
  })
  connection.onCompletionResolve((item): CompletionItem => empty(item))

  connection.onHover((params): Hover | null => {
    void store.get(params.textDocument.uri)
    return null
  })

  connection.onCodeAction((params): CodeAction[] => {
    void store.get(params.textDocument.uri)
    return []
  })

  connection.onDocumentSymbol((params): DocumentSymbol[] => {
    void store.get(params.textDocument.uri)
    return []
  })

  connection.onDefinition((params): LocationLink[] | null => {
    void store.get(params.textDocument.uri)
    return null
  })

  connection.languages.inlayHint.on((params): InlayHint[] => {
    void store.get(params.textDocument.uri)
    return []
  })

  const emptyTokens = (): SemanticTokens => ({ data: [] })
  connection.languages.semanticTokens.on(emptyTokens)
  connection.languages.semanticTokens.onRange(emptyTokens)
}
