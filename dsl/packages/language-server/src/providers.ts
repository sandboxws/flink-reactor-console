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
import type { Connection, TextDocuments } from "vscode-languageserver/node"
import type { TextDocument } from "vscode-languageserver-textdocument"
import type { ServerConfig } from "./config.js"
import type { DocumentStateStore } from "./document-state.js"
import { provideHover } from "./hover/provider.js"
import { provideCompletion } from "./providers/completion/index.js"

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
  documents: TextDocuments<TextDocument>,
  getConfig: () => ServerConfig,
): void {
  const empty = <T>(value: T) => value

  // Context-aware DSL completion (vscode-tier-1-feature-3). Classifies against
  // the *current* document text and serves child components, connector props,
  // enum values, and Flink types. Independent of synthesis state. Suppresses
  // child-component items when the ts-plugin owns them in-tsserver.
  connection.onCompletion((params): CompletionList => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { isIncomplete: false, items: [] }
    return provideCompletion({
      sourceText: doc.getText(),
      fileName: params.textDocument.uri,
      position: params.position,
      tsPluginActive: getConfig().tsPluginActive,
    })
  })
  connection.onCompletionResolve((item): CompletionItem => empty(item))

  // Synthesis-backed DSL hover (vscode-tier-1-feature-2). Classifies against the
  // *current* document text and reads the shared synthesis state for the doc
  // version, so it can flag staleness; returns null for non-FR tokens so the
  // ts-plugin's plain-TS hover shows instead.
  connection.onHover((params): Hover | null => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    return provideHover({
      state: store.get(params.textDocument.uri),
      sourceText: doc.getText(),
      fileName: params.textDocument.uri,
      position: params.position,
      documentVersion: doc.version,
    })
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
