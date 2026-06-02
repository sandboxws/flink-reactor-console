import { type ChildProcess, spawn } from "node:child_process"

interface JsonRpcMessage {
  jsonrpc: "2.0"
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

type NotificationHandler = (params: unknown) => void

/**
 * A tiny, dependency-free LSP client: spawns the server binary and speaks
 * Content-Length-framed JSON-RPC over its stdio. Enough to drive the
 * lifecycle + diagnostics scenarios in the integration tests.
 */
export class LspClient {
  private readonly proc: ChildProcess
  private buffer = Buffer.alloc(0)
  private nextId = 1
  private readonly pending = new Map<number, (msg: JsonRpcMessage) => void>()
  private readonly handlers = new Map<string, NotificationHandler[]>()
  readonly stderr: string[] = []

  constructor(binPath: string) {
    this.proc = spawn(process.execPath, [binPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    this.proc.stdout?.on("data", (chunk: Buffer) => this.onData(chunk))
    this.proc.stderr?.on("data", (chunk: Buffer) =>
      this.stderr.push(chunk.toString("utf8")),
    )
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n")
      if (headerEnd === -1) break
      const header = this.buffer.subarray(0, headerEnd).toString("utf8")
      const match = /Content-Length: (\d+)/i.exec(header)
      const bodyStart = headerEnd + 4
      if (!match) {
        this.buffer = this.buffer.subarray(bodyStart)
        continue
      }
      const length = Number.parseInt(match[1], 10)
      if (this.buffer.length < bodyStart + length) break
      const body = this.buffer
        .subarray(bodyStart, bodyStart + length)
        .toString("utf8")
      this.buffer = this.buffer.subarray(bodyStart + length)
      this.dispatch(JSON.parse(body) as JsonRpcMessage)
    }
  }

  private dispatch(msg: JsonRpcMessage): void {
    if (
      msg.id !== undefined &&
      (msg.result !== undefined || msg.error !== undefined)
    ) {
      const resolve = this.pending.get(msg.id)
      if (resolve) {
        this.pending.delete(msg.id)
        resolve(msg)
      }
      return
    }
    if (msg.method) {
      for (const h of this.handlers.get(msg.method) ?? []) h(msg.params)
    }
  }

  private write(msg: JsonRpcMessage): void {
    const json = JSON.stringify(msg)
    this.proc.stdin?.write(
      `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`,
    )
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, (msg) => {
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result as T)
      })
      this.write({ jsonrpc: "2.0", id, method, params })
    })
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params })
  }

  onNotification(method: string, handler: NotificationHandler): void {
    const arr = this.handlers.get(method) ?? []
    arr.push(handler)
    this.handlers.set(method, arr)
  }

  /** Resolve with the diagnostics for `uri` once `predicate` holds. */
  waitForDiagnostics(
    uri: string,
    predicate: (diags: unknown[]) => boolean,
    timeoutMs = 15_000,
  ): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for diagnostics on ${uri}`)),
        timeoutMs,
      )
      this.onNotification("textDocument/publishDiagnostics", (params) => {
        const p = params as { uri: string; diagnostics: unknown[] }
        if (p.uri === uri && predicate(p.diagnostics)) {
          clearTimeout(timer)
          resolve(p.diagnostics)
        }
      })
    })
  }

  waitForExit(timeoutMs = 5000): Promise<number> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("server did not exit")),
        timeoutMs,
      )
      this.proc.on("exit", (code) => {
        clearTimeout(timer)
        resolve(code ?? -1)
      })
    })
  }

  kill(): void {
    this.proc.kill("SIGKILL")
  }
}
