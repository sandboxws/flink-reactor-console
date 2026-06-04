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
import { GatewayCoordinator } from "./gateway/coordinator.js"
import { GatewayValidator } from "./gateway/deep-validate.js"
import {
  DEEP_VALIDATE_REQUEST,
  type DeepValidateParams,
  type DeepValidateResponse,
  GATEWAY_STATE_NOTIFICATION,
  type GatewayState,
} from "./gateway/model.js"
import { DualChannelDiagnostics } from "./gateway/publisher.js"
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

// Gateway-validation wire contract (gateway-validation, Tier-3 feature 11) —
// the deep-validate request + gateway-state notification clients mirror.
export {
  DEEP_VALIDATE_REQUEST,
  type DeepValidateParams,
  type DeepValidateResponse,
  type DeepValidateSkipReason,
  GATEWAY_STATE_NOTIFICATION,
  type GatewayState,
  type GatewayStateNotification,
} from "./gateway/model.js"
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

  // Dual-channel diagnostics (gateway-validation, Tier-3 feature 11): the
  // static (Tier-1) and gateway sets are stored per document and published as
  // one concatenation, so neither pass ever clears the other's findings.
  const diagnostics = new DualChannelDiagnostics((uri, diags) => {
    connection.sendDiagnostics({ uri, diagnostics: diags })
  })

  // Opt-in SQL Gateway deep validation: explicit command + optional on-save,
  // never per keystroke. Everything short-circuits while
  // `flinkReactor.gateway.enabled` is false (the default).
  const gateway = new GatewayCoordinator({
    getConfig: () => config.gateway,
    getTargetFlinkVersion: () => config.flinkVersion,
    getState: (uri) => store.get(uri),
    publisher: diagnostics,
    validator: new GatewayValidator(),
    notifyState: (state: GatewayState, message?: string) => {
      void connection.sendNotification(GATEWAY_STATE_NOTIFICATION, {
        state,
        ...(message !== undefined ? { message } : {}),
      })
    },
    showWarning: (message) => {
      void connection.window.showWarningMessage(message)
    },
    log: (message) => connection.console.warn(message),
    beginProgress: async (title) => {
      const progress = await connection.window.createWorkDoneProgress()
      progress.begin(title)
      return { done: () => progress.done() }
    },
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
          // didSave drives the optional gateway validate-on-save trigger.
          save: { includeText: false },
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
        // Schema-aware rename (component-refactoring, Tier-3 feature 14):
        // prepareRename gates the target before the client prompts.
        renameProvider: { prepareProvider: true },
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
    const previousGateway = config.gateway
    config = next
    if (timeoutChanged) recreateRunner()
    gateway.onConfigChanged(previousGateway, next.gateway)
    // Re-validate all open documents under the new config.
    for (const doc of documents.all()) scheduleSynth(doc)
  })

  connection.onShutdown(async () => {
    for (const timer of debounceTimers.values()) clearTimeout(timer)
    debounceTimers.clear()
    store.clear()
    await gateway.dispose()
    await runner.dispose()
  })

  // ── Document sync → debounced re-synthesis ──────────────────────────

  // `onDidChangeContent` fires on open and on every incremental change.
  documents.onDidChangeContent((change) => scheduleSynth(change.document))

  // Gateway validate-on-save (never on change/keystroke): only when the
  // author opted into both the gateway and the on-save cadence.
  documents.onDidSave((event) => {
    if (!config.gateway.enabled || !config.gateway.validateOnSave) return
    if (!isPipelineDocument(event.document)) return
    void gateway.runPass(event.document.uri)
  })

  documents.onDidClose((event) => {
    const uri = event.document.uri
    const timer = debounceTimers.get(uri)
    if (timer) {
      clearTimeout(timer)
      debounceTimers.delete(uri)
    }
    store.delete(uri)
    sqlSemanticTokens.forget(uri)
    // Clear both diagnostic channels for the closed document.
    diagnostics.forget(uri)
  })

  // The explicit "Deep validate pipeline" trigger (the VS Code shell's
  // command dispatches here). Resolves with an outcome envelope — failures
  // are data, never RPC errors, so the client renders them gently.
  connection.onRequest(
    DEEP_VALIDATE_REQUEST,
    (params: DeepValidateParams): Promise<DeepValidateResponse> =>
      gateway.runPass(params.uri),
  )

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
    // Static channel only — gateway findings live on their own half and are
    // never cleared by the static replace-on-change cycle.
    diagnostics.setStatic(
      uri,
      toLspDiagnostics(result, mapperContext(positionMap, text, uri)),
    )
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
      await gateway.dispose()
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
