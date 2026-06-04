import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type Connection,
  createConnection,
  type InitializeResult,
  ProposedFeatures,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DEFAULT_CONFIG, parseConfig, type ServerConfig } from "./config.js"
import { mapperContext, toLspDiagnostics } from "./diagnostics/index.js"
import { DocumentStateStore } from "./document-state.js"
import { SYNTHESIZED_NOTIFICATION } from "./graph/model.js"
import { createInlayHintRefresher } from "./inlay-hints/refresh.js"
import { buildPositionMap } from "./mappers/source-position-mapper.js"
import {
  SQL_SEMANTIC_LEGEND,
  SqlSemanticTokensProvider,
} from "./providers/sql-semantic-tokens.js"
import { registerProviders } from "./providers.js"
import { cacheKeyFor, ResultCache } from "./synth/cache.js"
import { IsolatedRunner } from "./synth/isolated-runner.js"

// Public wire contract for the `dag-visualization` capability — re-exported so
// LSP clients (the VS Code extension + its webview) share one source of truth.
export {
  GRAPH_MODEL_REQUEST,
  type GraphModelColumn,
  type GraphModelDiagnostic,
  type GraphModelEdge,
  type GraphModelNode,
  type GraphModelParams,
  type GraphModelResponse,
  NODE_RANGE_REQUEST,
  type NodeRangeParams,
  type NodeRangeResult,
  SYNTHESIZED_NOTIFICATION,
  type SynthesizedNotification,
} from "./graph/model.js"
// CRD-preview wire contract (crd-preview capability) — same one-source-of-truth
// re-export so the extension + its webview share the artifact-set contract.
export {
  CRD_PREVIEW_REQUEST,
  type CrdArtifact,
  type CrdPreviewParams,
  type CrdPreviewPipeline,
  type CrdPreviewResponse,
  type CrdPreviewStatus,
} from "./preview/crd-model.js"
// SQL-preview wire contract (sql-preview capability) — same one-source-of-truth
// re-export so the extension + its webview import the types from one place.
export {
  NODE_AT_POSITION_REQUEST,
  type NodeAtPositionParams,
  type NodeAtPositionResult,
  SYNTH_REQUEST,
  type SynthFragment,
  type SynthParams,
  type SynthPipeline,
  type SynthResponse,
  type SynthStatementMeta,
  type SynthStatementOrigin,
} from "./preview/model.js"
// Schema-tree wire contract (schema-navigation capability) — same one-source-of-
// truth re-export so the extension + its Schema Explorer share the contract.
export {
  SCHEMA_TREE_REQUEST,
  type SchemaTableInfo,
  type SchemaTreeField,
  type SchemaTreeLocation,
  type SchemaTreeParams,
  type SchemaTreeResponse,
  type SchemaTreeWatermark,
} from "./preview/schema-tree-model.js"
// Embedded-SQL semantic-token legend + provider (embedded-sql-highlighting,
// Tier-2 feature 9) — re-exported so an embedding client can read the legend.
export {
  SQL_SEMANTIC_LEGEND,
  SQL_TOKEN_MODIFIERS,
  SQL_TOKEN_TYPES,
} from "./providers/sql-semantic-tokens.js"
export type { PipelineKind } from "./synth/types.js"

export interface ServerHandle {
  readonly connection: Connection
  readonly documents: TextDocuments<TextDocument>
  dispose(): Promise<void>
}

/**
 * Wire up the FlinkReactor language server on an existing connection. Exposed
 * so clients can embed the server in-process (pass a connection built over a
 * message channel); `startServer()` is the stdio entry point.
 */
export function createServer(connection: Connection): ServerHandle {
  const documents = new TextDocuments(TextDocument)
  const store = new DocumentStateStore()
  const cache = new ResultCache()
  const sqlSemanticTokens = new SqlSemanticTokensProvider()

  let config: ServerConfig = DEFAULT_CONFIG
  let runner = new IsolatedRunner({
    timeoutMs: config.timeoutMs,
    maxOldGenerationSizeMb: config.maxOldGenerationSizeMb,
    cache,
  })
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // Pull-model staleness signal for inlay hints: at most one
  // `workspace/inlayHint/refresh` per completed synthesis, and only when the
  // client advertised refresh support (schema-inlay-hints, Tier-3 feature 10).
  let inlayHintRefreshSupported = false
  const inlayHintRefresher = createInlayHintRefresher({
    refreshSupported: () => inlayHintRefreshSupported,
    send: () => connection.sendRequest("workspace/inlayHint/refresh"),
  })

  function recreateRunner(): void {
    void runner.dispose()
    runner = new IsolatedRunner({
      timeoutMs: config.timeoutMs,
      bootGraceMs: config.bootGraceMs,
      maxOldGenerationSizeMb: config.maxOldGenerationSizeMb,
      cache,
    })
    // Spawn the worker now so its thread boot + bundled-DSL load overlap startup
    // rather than counting against the user's first synthesis. Skip when the
    // server is disabled — there will be no synthesis to warm for.
    if (config.enabled) runner.prewarm()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  connection.onInitialize((params): InitializeResult => {
    config = parseConfig(params.initializationOptions, config)
    inlayHintRefreshSupported =
      params.capabilities.workspace?.inlayHint?.refreshSupport === true
    recreateRunner()
    return {
      capabilities: {
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Incremental,
        },
        completionProvider: {
          resolveProvider: true,
          // `<` child tags, `.` dot-notation, space → attribute names, `=`/`"`/`'`/`{`
          // → values, `:` → a Flink type after a field name.
          triggerCharacters: ["<", ".", " ", '"', "'", "=", ":", "{"],
        },
        hoverProvider: true,
        codeActionProvider: true,
        documentSymbolProvider: true,
        definitionProvider: true,
        inlayHintProvider: true,
        semanticTokensProvider: {
          legend: SQL_SEMANTIC_LEGEND,
          range: true,
          full: true,
        },
        // Custom requests are not part of the standard capability set; advertise
        // them under `experimental` so a client can feature-detect before
        // sending `flinkReactor/crdPreview` (crd-preview, Tier-2 feature 6).
        experimental: {
          flinkReactorCrdPreview: true,
        },
      },
    }
  })

  connection.onInitialized(() => {
    connection.console.info("FlinkReactor language server initialized")
  })

  connection.onDidChangeConfiguration((change) => {
    const next = parseConfig(change.settings, config)
    const timeoutChanged =
      next.timeoutMs !== config.timeoutMs ||
      next.maxOldGenerationSizeMb !== config.maxOldGenerationSizeMb
    config = next
    if (timeoutChanged) recreateRunner()
    // Re-validate all open documents under the new config.
    for (const doc of documents.all()) scheduleSynth(doc)
  })

  connection.onShutdown(async () => {
    for (const timer of debounceTimers.values()) clearTimeout(timer)
    debounceTimers.clear()
    store.clear()
    await runner.dispose()
  })

  // ── Document sync → debounced re-synthesis ──────────────────────────

  // `onDidChangeContent` fires on open and on every incremental change.
  documents.onDidChangeContent((change) => scheduleSynth(change.document))

  documents.onDidClose((event) => {
    const uri = event.document.uri
    const timer = debounceTimers.get(uri)
    if (timer) {
      clearTimeout(timer)
      debounceTimers.delete(uri)
    }
    store.delete(uri)
    sqlSemanticTokens.forget(uri)
    // Clear diagnostics for the closed document.
    connection.sendDiagnostics({ uri, diagnostics: [] })
  })

  registerProviders(
    connection,
    store,
    documents,
    () => config,
    sqlSemanticTokens,
  )

  function scheduleSynth(doc: TextDocument): void {
    if (!config.enabled) return
    if (!isPipelineDocument(doc)) return
    const uri = doc.uri
    const existing = debounceTimers.get(uri)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      void runSynth(uri, doc.version)
    }, config.debounceMs)
    debounceTimers.set(uri, timer)
  }

  async function runSynth(uri: string, version: number): Promise<void> {
    debounceTimers.delete(uri)
    const doc = documents.get(uri)
    if (!doc || doc.version !== version) return // superseded by a newer edit

    const entryPoint = uriToPath(uri)
    if (!entryPoint) return
    const text = doc.getText()
    const projectDir = findProjectRoot(entryPoint)

    const result = await runner.synthesize(
      {
        entryPoint,
        projectDir,
        documentText: text,
        flinkVersion: config.flinkVersion,
      },
      cacheKeyFor(text, projectDir),
    )

    // The document may have moved on while synthesis was in flight.
    const current = documents.get(uri)
    if (current && current.version !== version) return

    const positionMap = buildPositionMap(text, entryPoint, result.nodes)
    store.set({ uri, version, result, positionMap })
    connection.sendDiagnostics({
      uri,
      diagnostics: toLspDiagnostics(
        result,
        mapperContext(positionMap, text, uri),
      ),
    })
    // Signal interested clients (the DAG panel) that a fresh model is ready
    // for this document version, so they can pull `flinkReactor/graphModel`.
    void connection.sendNotification(SYNTHESIZED_NOTIFICATION, { uri, version })
    // Inlay hints are pull-based: ask the client to re-query the visible range
    // now that counts/modes/parallelism may have changed (once per synthesis —
    // this sits on the debounced completion, never on keystrokes).
    inlayHintRefresher.onSynthesized()
  }

  documents.listen(connection)
  connection.listen()

  return {
    connection,
    documents,
    async dispose() {
      for (const timer of debounceTimers.values()) clearTimeout(timer)
      debounceTimers.clear()
      store.clear()
      await runner.dispose()
    },
  }
}

/** stdio entry point: spawn a connection over stdin/stdout and start serving. */
export function startServer(): ServerHandle {
  const connection = createConnection(
    ProposedFeatures.all,
    new StreamMessageReader(process.stdin),
    new StreamMessageWriter(process.stdout),
  )
  return createServer(connection)
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Only pipeline `.tsx` documents (those importing the DSL) are synthesized;
 *  arbitrary `.tsx` files are ignored so the server stays quiet. */
function isPipelineDocument(doc: TextDocument): boolean {
  if (!doc.uri.endsWith(".tsx")) return false
  return /from\s+["']@flink-reactor\/dsl/.test(doc.getText())
}

function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}

/**
 * Find the project root for a pipeline file: the nearest ancestor containing
 * `flink-reactor.config.ts`, else the nearest with a `package.json`, else the
 * file's own directory.
 */
function findProjectRoot(filePath: string): string {
  let dir = dirname(filePath)
  let packageRoot: string | undefined
  for (let i = 0; i < 50; i++) {
    if (existsSync(join(dir, "flink-reactor.config.ts"))) return dir
    if (!packageRoot && existsSync(join(dir, "package.json"))) packageRoot = dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return packageRoot ?? dirname(filePath)
}
