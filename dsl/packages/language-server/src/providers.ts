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
import { type ServerConfig, sqlSemanticTokensEnabled } from "./config.js"
import type { DocumentStateStore } from "./document-state.js"
import {
  GRAPH_MODEL_REQUEST,
  type GraphModelParams,
  type GraphModelResponse,
  NODE_RANGE_REQUEST,
  type NodeRangeParams,
  type NodeRangeResult,
} from "./graph/model.js"
import { provideHover } from "./hover/provider.js"
import { provideInlayHints } from "./inlay-hints/provider.js"
import { nodeAtPosition } from "./mappers/source-position-mapper.js"
import {
  CRD_PREVIEW_REQUEST,
  type CrdPreviewParams,
  type CrdPreviewResponse,
} from "./preview/crd-model.js"
import {
  NODE_AT_POSITION_REQUEST,
  type NodeAtPositionParams,
  type NodeAtPositionResult,
  SYNTH_REQUEST,
  type SynthParams,
  type SynthResponse,
} from "./preview/model.js"
import {
  SCHEMA_TREE_REQUEST,
  type SchemaTreeParams,
  type SchemaTreeResponse,
} from "./preview/schema-tree-model.js"
import { provideCompletion } from "./providers/completion/index.js"
import { buildCrdPreviewModel } from "./providers/crd-preview.js"
import { provideDefinition } from "./providers/definition/index.js"
import { buildGraphModel } from "./providers/graph-model.js"
import { buildSchemaTreeModel } from "./providers/schema-tree.js"
import type {
  SqlSemanticTokensProvider,
  TokenInput,
} from "./providers/sql-semantic-tokens.js"
import { buildSynthModel } from "./providers/synth-model.js"

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
  sqlSemanticTokens: SqlSemanticTokensProvider,
): void {
  const empty = <T>(value: T) => value

  /** A document is FR-pipeline-like (eligible for SQL coloring) when it imports
   *  the DSL — pipelines and `schemas/*.ts` modules both do. Mirrors the
   *  server's `isPipelineDocument` gate so non-FR `.tsx` is left plain. */
  const importsDsl = (text: string): boolean =>
    /from\s+["']@flink-reactor\/dsl/.test(text)

  // Context-aware DSL completion. Classifies against the *current* document text
  // and serves child components, connector props, enum values, and Flink types
  // from static metadata, plus synthesis-backed column completions inside
  // expression props (vscode-tier-1-feature-4) — those read the shared synthesis
  // state for the document. Suppresses child-component items when the ts-plugin
  // owns them in-tsserver.
  connection.onCompletion((params): CompletionList => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { isIncomplete: false, items: [] }
    return provideCompletion({
      sourceText: doc.getText(),
      fileName: params.textDocument.uri,
      position: params.position,
      tsPluginActive: getConfig().tsPluginActive,
      synthState: store.get(params.textDocument.uri),
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

  // FlinkReactor go-to-definition (schema-navigation, Tier-2): resolves a
  // catalog-handle prop, a column reference in an expression prop, or a
  // node-input prop to its source declaration. Returns null for non-FR tokens
  // and unresolvable targets so the default TypeScript handler still runs.
  connection.onDefinition((params): LocationLink[] | null => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    return provideDefinition({
      state: store.get(params.textDocument.uri),
      sourceText: doc.getText(),
      uri: params.textDocument.uri,
      position: params.position,
    })
  })

  // Synthesis-backed inlay hints (schema-inlay-hints, Tier-3 feature 10): per-
  // component output schema (count/compact), changelog mode, and effective
  // parallelism, plus window time-column and join merged-count annotations —
  // each part gated by its `flinkReactor.inlayHints.*` toggle. Pure read over
  // the shared synthesis state; empty while synthesis trails the document
  // version (the post-synthesis refresh re-pulls).
  connection.languages.inlayHint.on((params): InlayHint[] => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    return provideInlayHints({
      state: store.get(params.textDocument.uri),
      documentVersion: doc.version,
      range: params.range,
      config: getConfig().inlayHints,
    })
  })

  // Embedded-SQL semantic tokens (embedded-sql-highlighting, Tier-2 feature 9):
  // the precise, synthesis-aware coloring layer VS Code renders *over* the
  // TextMate injection grammar. Range-finding is AST-only, so tokens are emitted
  // even when synthesis failed; the provider caches per document version and
  // never throws. Suppressed (empty) when `flinkReactor.sql.highlighting` is
  // `textmate`/`off`, or for non-FR documents.
  const tokenInput = (doc: TextDocument): TokenInput => {
    const sourceText = doc.getText()
    return {
      uri: doc.uri,
      version: doc.version,
      sourceText,
      fileName: doc.uri,
      enabled: sqlSemanticTokensEnabled(getConfig()) && importsDsl(sourceText),
    }
  }
  connection.languages.semanticTokens.on((params): SemanticTokens => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { data: [] }
    return sqlSemanticTokens.full(tokenInput(doc))
  })
  connection.languages.semanticTokens.onRange((params): SemanticTokens => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { data: [] }
    return sqlSemanticTokens.range(
      tokenInput(doc),
      params.range.start.line,
      params.range.end.line,
    )
  })

  // ── Custom requests (dag-visualization + sql-preview) ───────────────
  // The webview-facing graph/synth models and click-to-source range, all
  // projected from the shared per-document synthesis state. Defensive: the
  // handlers never throw — a failed/absent synthesis becomes an `ok: false`
  // envelope so the panel degrades gracefully instead of surfacing an RPC
  // error. None of them re-synthesizes: each is a lookup-and-serialize of the
  // cached result, so the synthesis pass counter is unaffected by request
  // volume. `flinkReactor/nodeRange` doubles as the spec's `locateNode`
  // companion for SQL→DSL navigation (identical `{uri,nodeId}`→`Range`
  // contract); no duplicate method is registered.

  connection.onRequest(
    GRAPH_MODEL_REQUEST,
    (params: GraphModelParams): GraphModelResponse => {
      const fallbackVersion = params.version ?? 0
      try {
        const state = store.get(params.uri)
        if (!state) {
          return {
            uri: params.uri,
            version: fallbackVersion,
            ok: false,
            error: "Pipeline has not been synthesized yet.",
            nodes: [],
            edges: [],
            statements: [],
          }
        }
        return buildGraphModel(state.uri, state.version, state.result)
      } catch (err) {
        return {
          uri: params.uri,
          version: fallbackVersion,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          nodes: [],
          edges: [],
          statements: [],
        }
      }
    },
  )

  connection.onRequest(
    NODE_RANGE_REQUEST,
    (params: NodeRangeParams): NodeRangeResult => {
      const range = store.get(params.uri)?.positionMap.map.get(params.nodeId)
      return {
        range: range ? { start: range.start, end: range.end } : null,
      }
    },
  )

  // SQL preview (sql-preview, vscode-tier-2-feature-5): serialize the cached
  // per-pipeline synthesis result (statements + source maps) for the read-only
  // SQL-preview webview. Pure projection — never calls the synthesis runner.
  connection.onRequest(SYNTH_REQUEST, (params: SynthParams): SynthResponse => {
    const fallbackVersion = params.version ?? 0
    try {
      const state = store.get(params.uri)
      if (!state) {
        return {
          uri: params.uri,
          version: fallbackVersion,
          ok: false,
          error: "Pipeline has not been synthesized yet.",
          pipelines: [],
        }
      }
      return buildSynthModel(state.uri, state.version, state.result)
    } catch (err) {
      return {
        uri: params.uri,
        version: fallbackVersion,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        pipelines: [],
      }
    }
  })

  // SQL preview DSL→SQL inverse: resolve the editor caret position to the
  // innermost node under it (the source-position map's reverse lookup).
  connection.onRequest(
    NODE_AT_POSITION_REQUEST,
    (params: NodeAtPositionParams): NodeAtPositionResult => {
      const state = store.get(params.uri)
      if (!state) return { nodeId: null }
      return { nodeId: nodeAtPosition(state.positionMap, params.position) }
    },
  )

  // CRD preview (crd-preview, vscode-tier-2-feature-6): serialize the cached
  // per-pipeline Kubernetes artifact set (CRD/blue-green, wrapping ConfigMap,
  // CDC pipeline.yaml, secondary resources) for the read-only tabbed webview.
  // Pure projection — the artifact YAML was serialized in the worker; this
  // never calls the synthesis runner. A synthesis failure resolves with a
  // `status: "error"` pipeline (not an RPC rejection) so the webview can keep
  // its last-good set behind a stale banner. An un-synthesized document
  // resolves with no pipelines so the webview shows its waiting state.
  connection.onRequest(
    CRD_PREVIEW_REQUEST,
    (params: CrdPreviewParams): CrdPreviewResponse => {
      const fallbackVersion = params.version ?? 0
      try {
        const state = store.get(params.uri)
        if (!state) {
          return {
            uri: params.uri,
            documentVersion: fallbackVersion,
            pipelines: [],
          }
        }
        return buildCrdPreviewModel(state.uri, state.version, state.result)
      } catch (err) {
        return {
          uri: params.uri,
          documentVersion: fallbackVersion,
          pipelines: [
            {
              pipelineName: "pipeline",
              pipelineKind: "standard",
              status: "error",
              error: err instanceof Error ? err.message : String(err),
              artifacts: [],
            },
          ],
        }
      }
    },
  )

  // Schema tree (schema-navigation, vscode-tier-2-feature-8): serialize the
  // cached pipeline's sources/sinks + fields/PK/watermark + per-node/-field
  // `locationRef`s for the read-only Schema Explorer tree. Pure projection of
  // the held state (and the source AST for positions) — never re-synthesizes. A
  // failed synthesis resolves with `ok: false` + an error indicator (not an RPC
  // rejection) so the tree keeps its last-good tables; an un-synthesized or
  // unopened document resolves with no tables.
  connection.onRequest(
    SCHEMA_TREE_REQUEST,
    (params: SchemaTreeParams): SchemaTreeResponse => {
      const fallbackVersion = params.version ?? 0
      try {
        const state = store.get(params.uri)
        const doc = documents.get(params.uri)
        if (!state || !doc) {
          return {
            uri: params.uri,
            version: fallbackVersion,
            ok: false,
            error: "Pipeline has not been synthesized yet.",
            tables: [],
          }
        }
        return buildSchemaTreeModel(state, doc.getText())
      } catch (err) {
        return {
          uri: params.uri,
          version: fallbackVersion,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          tables: [],
        }
      }
    },
  )
}
