import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"
import { ResultCache } from "./cache.js"
import type { LoadErrorKind, SynthesisInput, SynthesisResult } from "./types.js"

interface WorkerResponse {
  readonly id: number
  readonly result?: SynthesisResult
  readonly error?: { readonly message: string; readonly stack?: string }
}

interface Pending {
  readonly resolve: (r: SynthesisResult) => void
  timer: ReturnType<typeof setTimeout> | null
  settled: boolean
}

export interface IsolatedRunnerOptions {
  /** Per-synthesis wall-clock budget. On expiry the worker is terminated and
   *  respawned and a `timeout` diagnostic is returned. Default 5000ms. */
  readonly timeoutMs?: number
  /** Worker heap ceiling (MB). Guards against runaway memory in user code.
   *  Default 512. */
  readonly maxOldGenerationSizeMb?: number
  /** Override the worker entry path (tests). Defaults to the sibling
   *  `worker.js` in the built output. */
  readonly workerPath?: string
  /** Shared result cache. A fresh bounded cache is created if omitted. */
  readonly cache?: ResultCache
}

/** Build the serializable error-result shell returned when synthesis cannot
 *  complete in isolation (timeout / crash). */
function errorResult(kind: LoadErrorKind, message: string): SynthesisResult {
  return {
    ok: false,
    statements: [],
    sql: "",
    diagnostics: [],
    statementOrigins: [],
    statementContributors: [],
    statementMeta: [],
    edges: [],
    dagEdges: [],
    changelogModes: [],
    sinkChangelogAccepts: [],
    nodeInputSchemas: [],
    pipelineManifest: null,
    crdYaml: "",
    pipelineKind: "standard",
    artifacts: [],
    nodes: [],
    loadError: { kind, message },
  }
}

/**
 * Runs pipeline synthesis behind a worker-thread isolation boundary.
 *
 * - A timeout terminates the worker (the only way to interrupt a synchronous
 *   infinite loop in user code) and respawns it; the call resolves to a
 *   single `timeout` diagnostic.
 * - A worker crash/exit rejects all in-flight calls as `crash` and respawns.
 * - A `cacheKey` lets unchanged documents skip the worker entirely.
 */
export class IsolatedRunner {
  private worker: Worker | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private disposed = false

  private readonly timeoutMs: number
  private readonly maxOldGenerationSizeMb: number
  private readonly workerPath: string
  private readonly cache: ResultCache

  constructor(opts: IsolatedRunnerOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 5000
    this.maxOldGenerationSizeMb = opts.maxOldGenerationSizeMb ?? 512
    this.workerPath =
      opts.workerPath ??
      join(dirname(fileURLToPath(import.meta.url)), "worker.js")
    this.cache = opts.cache ?? new ResultCache()
  }

  /** Synthesize a document in isolation. `cacheKey`, when provided, short-
   *  circuits to a cached result on a hit and stores successful results. */
  async synthesize(
    input: SynthesisInput,
    cacheKey?: string,
  ): Promise<SynthesisResult> {
    if (this.disposed) {
      return errorResult("crash", "language server is shutting down")
    }

    if (cacheKey) {
      const hit = this.cache.get(cacheKey)
      if (hit) return hit
    }

    const result = await this.dispatch(input)

    // Only cache results that actually completed synthesis; never cache a
    // timeout/crash (those are transient and should be retried).
    if (
      cacheKey &&
      result.loadError?.kind !== "timeout" &&
      result.loadError?.kind !== "crash"
    ) {
      this.cache.set(cacheKey, result)
    }
    return result
  }

  private dispatch(input: SynthesisInput): Promise<SynthesisResult> {
    const worker = this.ensureWorker()
    const id = this.nextId++

    return new Promise<SynthesisResult>((resolve) => {
      const entry: Pending = { resolve, timer: null, settled: false }
      this.pending.set(id, entry)

      entry.timer = setTimeout(() => {
        if (entry.settled) return
        entry.settled = true
        this.pending.delete(id)
        // A sync infinite loop can only be interrupted by killing the thread.
        this.killWorker(
          `synthesis exceeded ${this.timeoutMs}ms`,
          /* respawn */ false,
        )
        resolve(
          errorResult(
            "timeout",
            `Synthesis timed out after ${this.timeoutMs}ms. The pipeline may contain an infinite loop or extremely expensive evaluation.`,
          ),
        )
      }, this.timeoutMs)

      worker.postMessage({ id, input })
    })
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    const worker = new Worker(this.workerPath, {
      resourceLimits: { maxOldGenerationSizeMb: this.maxOldGenerationSizeMb },
    })

    worker.on("message", (msg: WorkerResponse) => {
      const entry = this.pending.get(msg.id)
      if (!entry || entry.settled) return
      entry.settled = true
      if (entry.timer) clearTimeout(entry.timer)
      this.pending.delete(msg.id)
      if (msg.result) {
        entry.resolve(msg.result)
      } else {
        entry.resolve(
          errorResult(
            "crash",
            msg.error?.message ?? "synthesis worker returned no result",
          ),
        )
      }
    })

    // A worker-level `error` or unexpected `exit` invalidates every in-flight
    // request; fail them as crashes and drop the worker so the next call
    // respawns it.
    const onDead = (reason: string) => {
      this.failAllPending("crash", reason)
      if (this.worker === worker) this.worker = null
    }
    worker.on("error", (err) => onDead(err.message))
    worker.on("exit", (code) => {
      if (code !== 0) onDead(`synthesis worker exited with code ${code}`)
    })

    this.worker = worker
    return worker
  }

  private killWorker(reason: string, respawn: boolean): void {
    const worker = this.worker
    this.worker = null
    this.failAllPending("crash", reason)
    if (worker) void worker.terminate()
    if (respawn && !this.disposed) this.ensureWorker()
  }

  private failAllPending(kind: LoadErrorKind, reason: string): void {
    for (const [id, entry] of this.pending) {
      if (entry.settled) continue
      entry.settled = true
      if (entry.timer) clearTimeout(entry.timer)
      this.pending.delete(id)
      entry.resolve(errorResult(kind, reason))
    }
  }

  /** Release the worker and caches (server shutdown). */
  async dispose(): Promise<void> {
    this.disposed = true
    this.failAllPending("crash", "language server is shutting down")
    this.cache.clear()
    const worker = this.worker
    this.worker = null
    if (worker) await worker.terminate()
  }
}
