import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type Connection,
  createConnection,
  type InitializeResult,
  ProposedFeatures,
  type SemanticTokensLegend,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DEFAULT_CONFIG, parseConfig, type ServerConfig } from "./config.js"
import { toLspDiagnostics } from "./diagnostics.js"
import { DocumentStateStore } from "./document-state.js"
import { buildPositionMap } from "./mappers/source-position-mapper.js"
import { registerProviders } from "./providers.js"
import { cacheKeyFor, ResultCache } from "./synth/cache.js"
import { IsolatedRunner } from "./synth/isolated-runner.js"

const SEMANTIC_TOKEN_LEGEND: SemanticTokensLegend = {
  tokenTypes: ["keyword", "type", "variable", "string", "number"],
  tokenModifiers: [],
}

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

  let config: ServerConfig = DEFAULT_CONFIG
  let runner = new IsolatedRunner({
    timeoutMs: config.timeoutMs,
    maxOldGenerationSizeMb: config.maxOldGenerationSizeMb,
    cache,
  })
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function recreateRunner(): void {
    void runner.dispose()
    runner = new IsolatedRunner({
      timeoutMs: config.timeoutMs,
      maxOldGenerationSizeMb: config.maxOldGenerationSizeMb,
      cache,
    })
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  connection.onInitialize((params): InitializeResult => {
    config = parseConfig(params.initializationOptions, config)
    recreateRunner()
    return {
      capabilities: {
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Incremental,
        },
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ["<", ".", " ", '"', "'"],
        },
        hoverProvider: true,
        codeActionProvider: true,
        documentSymbolProvider: true,
        definitionProvider: true,
        inlayHintProvider: true,
        semanticTokensProvider: {
          legend: SEMANTIC_TOKEN_LEGEND,
          range: true,
          full: true,
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
    // Clear diagnostics for the closed document.
    connection.sendDiagnostics({ uri, diagnostics: [] })
  })

  registerProviders(connection, store)

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
      diagnostics: toLspDiagnostics(result, positionMap),
    })
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
