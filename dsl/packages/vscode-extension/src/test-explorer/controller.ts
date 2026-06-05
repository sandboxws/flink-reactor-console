// The `flinkReactor.pipelineTests` TestController (test-explorer §1/§3–§10).
//
// Discovery is filesystem-based (always works, Vitest or not): every
// `tests/pipelines/*.test.ts` under the project becomes a file item grouped
// under its pipeline; `describe`/`it` children resolve lazily from the
// lexical scan with source ranges, and snapshot/SQL-snapshot cases carry
// tags. Runs shell out to the PROJECT's Vitest with the JSON reporter
// written to a temp file (`--outputFile`) while the default reporter streams
// to a test output channel; parsed outcomes map back to items by
// file + concatenated title, dynamic titles surfacing as synthetic children.
// Failed SQL snapshots register their expected/received sides for the golden
// diff; failures attach inline `TestMessage`s (diff-shaped when both sides
// are recoverable) at the failing assertion's line. The single run profile
// supports CONTINUOUS runs (the Test Explorer's watch toggle): one
// `vitest --watch --reporter=json` per workspace feeds a long-lived
// `TestRun` until canceled. Missing Vitest degrades gracefully: discovery
// still lists files; a run errors each requested item with the reason.

import { type ChildProcess, spawn } from "node:child_process"
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import * as vscode from "vscode"
import { getOutputChannel } from "../ui/output.js"
import { discoverPipelines } from "../workspace/pipeline-discovery.js"
import {
  extractJsonDocuments,
  parseVitestJson,
  type VitestTestRecord,
} from "./json-parse.js"
import {
  clearSqlFailure,
  closeSqlGoldenDiff,
  setSqlFailure,
} from "./sql-diff.js"
import {
  extractSidesFromOutput,
  extractSnapshotSides,
  isSnapshotMismatch,
  snapshotNameOf,
  stripAnsi,
} from "./sql-extract.js"
import { type ScannedTest, scanTestFile } from "./test-scan.js"
import { resolveVitest } from "./vitest-resolver.js"

export const SNAPSHOT_TAG = new vscode.TestTag("snapshot")
export const SQL_SNAPSHOT_TAG = new vscode.TestTag("sqlSnapshot")

interface ItemMeta {
  readonly fileFsPath: string
  /** `describe > … > it` path used to match Vitest's reported fullName. */
  readonly titlePath: readonly string[]
  readonly snapshot: boolean
  readonly sqlSnapshot: boolean
}

/** A flattened view of one discovered item (the e2e suite's observable —
 *  the Test API exposes no cross-extension item enumeration). */
export interface TestItemSnapshot {
  readonly id: string
  readonly label: string
  readonly line?: number
  readonly tags: readonly string[]
}

export class PipelineTestExplorer {
  readonly controller: vscode.TestController
  /** itemId → latest outcome (`pass`/`fail`/`skip`/`errored`) — kept for the
   *  e2e suite; VS Code's own run UI state is not API-observable. */
  readonly lastOutcomes = new Map<string, string>()
  private readonly meta = new WeakMap<vscode.TestItem, ItemMeta>()
  private readonly disposables: vscode.Disposable[] = []
  private watchChild: ChildProcess | undefined
  private watchCancel: vscode.CancellationTokenSource | undefined
  private testOutput: vscode.OutputChannel | undefined
  /** The last one-shot run's combined reporter output — the diff-body source
   *  for SQL golden sides (the JSON reporter omits the diff). */
  private lastRunOutput = ""

  constructor(private readonly getProjectDir: () => string | undefined) {
    this.controller = vscode.tests.createTestController(
      "flinkReactor.pipelineTests",
      "FlinkReactor Pipeline Tests",
    )
    this.controller.resolveHandler = (item) => {
      if (!item) {
        this.discoverAll()
        return
      }
      this.resolveFileChildren(item)
    }
    this.controller.refreshHandler = () => this.discoverAll()

    const profile = this.controller.createRunProfile(
      "Run",
      vscode.TestRunProfileKind.Run,
      (request, token) => void this.runHandler(request, token),
      true,
    )
    profile.supportsContinuousRun = true // the watch toggle (§9)
    this.controller.createRunProfile(
      "Debug",
      vscode.TestRunProfileKind.Debug,
      (request, token) => void this.debugHandler(request, token),
      false,
    )

    // Incremental re-discovery on create/delete/change (task 1.5).
    const projectDir = this.getProjectDir()
    if (projectDir) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(projectDir),
          "tests/pipelines/*.test.ts",
        ),
      )
      const refresh = () => this.discoverAll()
      watcher.onDidCreate(refresh, undefined, this.disposables)
      watcher.onDidDelete(refresh, undefined, this.disposables)
      watcher.onDidChange(refresh, undefined, this.disposables)
      this.disposables.push(watcher)
    }

    this.discoverAll()
  }

  // ── Discovery (§1) ──────────────────────────────────────────────────

  /** Filesystem-only: lists whatever exists, Vitest installed or not. */
  discoverAll(): void {
    const projectDir = this.getProjectDir()
    this.controller.items.replace([])
    if (!projectDir) return
    const dir = join(projectDir, "tests", "pipelines")
    if (!existsSync(dir)) return // empty tree, no error (task 1.6/10.3)

    const knownPipelines = new Set(
      discoverPipelines(projectDir).map((p) => p.name),
    )
    for (const entry of readdirSync(dir).sort()) {
      if (!entry.endsWith(".test.ts")) continue
      const pipeline = entry.slice(0, -".test.ts".length)
      const fsPath = join(dir, entry)
      const uri = vscode.Uri.file(fsPath)

      // Group under the pipeline (corroborated against pipelines/*/index.tsx;
      // an unmatched file still lists, labeled by its stem — task 1.3).
      const groupId = `pipeline:${pipeline}`
      let group = this.controller.items.get(groupId)
      if (!group) {
        group = this.controller.createTestItem(
          groupId,
          knownPipelines.has(pipeline)
            ? pipeline
            : `${pipeline} (no pipeline dir)`,
        )
        this.controller.items.add(group)
      }
      const fileItem = this.controller.createTestItem(
        uri.toString(),
        entry,
        uri,
      )
      fileItem.canResolveChildren = true
      this.meta.set(fileItem, {
        fileFsPath: fsPath,
        titlePath: [],
        snapshot: false,
        sqlSnapshot: false,
      })
      group.children.add(fileItem)
      // Eager resolve keeps gutter decorations live for open editors.
      this.resolveFileChildren(fileItem)
    }
  }

  /** Lazy `describe`/`it` resolution with ranges + snapshot tags (§1.4/§2). */
  private resolveFileChildren(fileItem: vscode.TestItem): void {
    const fileMeta = this.meta.get(fileItem)
    if (!fileMeta || !fileItem.uri) return
    let text: string
    try {
      text = readFileSync(fileMeta.fileFsPath, "utf8")
    } catch {
      return
    }
    fileItem.children.replace([])
    const addChildren = (
      parent: vscode.TestItem,
      tests: readonly ScannedTest[],
      ancestors: readonly string[],
    ): void => {
      for (const test of tests) {
        const titlePath = [...ancestors, test.title]
        const id = `${fileItem.id}#${titlePath.join(" > ")}`
        const item = this.controller.createTestItem(
          id,
          test.title,
          fileItem.uri,
        )
        item.range = new vscode.Range(test.line, 0, test.line, 200)
        const tags: vscode.TestTag[] = []
        if (test.snapshot) tags.push(SNAPSHOT_TAG)
        if (test.sqlSnapshot) tags.push(SQL_SNAPSHOT_TAG)
        item.tags = tags
        this.meta.set(item, {
          fileFsPath: fileMeta.fileFsPath,
          titlePath,
          snapshot: test.snapshot,
          sqlSnapshot: test.sqlSnapshot,
        })
        parent.children.add(item)
        addChildren(item, test.children, titlePath)
      }
    }
    addChildren(fileItem, scanTestFile(text), [])
  }

  // ── Run scoping ─────────────────────────────────────────────────────

  /** The file paths + optional `-t` filter for a request's include set. */
  private scopeFor(request: vscode.TestRunRequest): {
    files: string[]
    nameFilter?: string
    leaves: vscode.TestItem[]
  } {
    const include = request.include ?? this.allFileItems()
    const files = new Set<string>()
    const leaves: vscode.TestItem[] = []
    let nameFilter: string | undefined
    for (const item of include) {
      const m = this.meta.get(item)
      if (!m) continue
      files.add(m.fileFsPath)
      leaves.push(item)
      if (include.length === 1 && m.titlePath.length > 0) {
        // A single sub-file selection narrows by full title (task 3.2).
        // Vitest's `-t` matches the SPACE-joined runtime name.
        nameFilter = m.titlePath.join(" ")
      }
    }
    return {
      files: [...files],
      ...(nameFilter !== undefined ? { nameFilter } : {}),
      leaves,
    }
  }

  private allFileItems(): vscode.TestItem[] {
    const files: vscode.TestItem[] = []
    this.controller.items.forEach((group) => {
      group.children.forEach((file) => {
        files.push(file)
      })
    })
    return files
  }

  // ── One-shot + continuous runs (§3/§9) ──────────────────────────────

  private async runHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
  ): Promise<void> {
    if (request.continuous) {
      this.startWatch(request, token)
      return
    }
    await this.runOnce(request, token)
  }

  /** Run Vitest once (optionally with `--update`) and map the outcomes. */
  async runOnce(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    options: { update?: boolean } = {},
  ): Promise<void> {
    const projectDir = this.getProjectDir()
    const run = this.controller.createTestRun(request)
    if (!projectDir) {
      run.end()
      return
    }
    const { files, nameFilter, leaves } = this.scopeFor(request)
    if (files.length === 0) {
      run.end()
      return
    }
    const vitest = resolveVitest(projectDir)
    if (vitest.kind === "not-found") {
      // Graceful degradation (task 10.2): error each requested item — and
      // every test beneath it, so leaf outcomes reflect the reason too.
      this.markErrored(run, leaves, vitest.message)
      run.end()
      return
    }

    for (const item of leaves) run.started(item)
    const outputFile = join(
      tmpdir(),
      `fr-vitest-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    )
    const args = [
      ...vitest.prefixArgs,
      "run",
      ...files.map((f) => relative(projectDir, f)),
      ...(nameFilter ? ["-t", nameFilter] : []),
      ...(options.update ? ["--update"] : []),
      "--reporter=json",
      `--outputFile=${outputFile}`,
      "--reporter=default",
    ]
    this.output().appendLine(`> vitest ${args.join(" ")}`)
    let allOutput = ""

    const exitCode = await new Promise<number>((resolve) => {
      const child = spawn(vitest.command, args, {
        cwd: projectDir,
        // ELECTRON_RUN_AS_NODE: the entry-fallback resolver runs vitest.mjs
        // under `process.execPath`, which in an extension host is ELECTRON —
        // this flag makes it behave as plain Node (harmless for the shim).
        env: {
          ...process.env,
          NO_COLOR: "1",
          FORCE_COLOR: "0",
          CI: "1",
          ELECTRON_RUN_AS_NODE: "1",
        },
      })
      const consume = (chunk: Buffer | string) => {
        const text = chunk.toString()
        allOutput += text
        run.appendOutput(text.replace(/\r?\n/g, "\r\n"))
        this.output().append(text)
      }
      child.stdout?.on("data", consume)
      child.stderr?.on("data", consume)
      token.onCancellationRequested(() => child.kill())
      child.on("error", () => resolve(1))
      child.on("close", (code) => resolve(code ?? 1))
    })
    this.lastRunOutput = allOutput

    let payload: string | undefined
    try {
      payload = readFileSync(outputFile, "utf8")
    } catch {
      payload = undefined
    }
    const summary = payload ? parseVitestJson(payload) : null
    if (!summary) {
      // task 10.4 — unparseable result is an errored run, not a crash.
      this.markErrored(
        run,
        leaves,
        `Couldn't parse Vitest's JSON output (exit code ${exitCode}). See the test output channel.`,
      )
      run.end()
      return
    }
    this.applyRecords(run, summary.records)
    run.end()
  }

  /** §9 — one `vitest --watch` per workspace feeding a continuous run. */
  private startWatch(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
  ): void {
    const projectDir = this.getProjectDir()
    if (!projectDir) return
    if (this.watchChild) {
      this.output().appendLine(
        "vitest --watch already running — reusing the existing watch.",
      )
      return
    }
    const vitest = resolveVitest(projectDir)
    const run = this.controller.createTestRun(request, "vitest --watch", false)
    if (vitest.kind === "not-found") {
      for (const item of this.allFileItems()) {
        run.errored(item, new vscode.TestMessage(vitest.message))
      }
      run.end()
      return
    }
    const args = [
      ...vitest.prefixArgs,
      "--watch",
      "tests/pipelines",
      "--reporter=json",
    ]
    this.output().appendLine(`> vitest ${args.join(" ")}`)
    const child = spawn(vitest.command, args, {
      cwd: projectDir,
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        ELECTRON_RUN_AS_NODE: "1", // see runOnce — execPath is Electron here
      },
    })
    this.watchChild = child
    let buffer = ""
    const consume = (chunk: Buffer | string) => {
      buffer += chunk.toString()
      const { documents, rest } = extractJsonDocuments(buffer)
      buffer = rest
      for (const doc of documents) {
        const summary = parseVitestJson(doc)
        if (summary) this.applyRecords(run, summary.records)
      }
    }
    child.stdout?.on("data", consume)
    child.stderr?.on("data", (chunk: Buffer) =>
      this.output().append(chunk.toString()),
    )
    const stop = () => {
      child.kill()
    }
    token.onCancellationRequested(stop)
    this.disposables.push({ dispose: stop })
    child.on("close", () => {
      this.watchChild = undefined
      run.end()
      this.output().appendLine("vitest --watch stopped")
    })
  }

  /** §4 — debug under the Node debugger; outcomes map like a normal run. */
  private async debugHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const projectDir = this.getProjectDir()
    if (!projectDir) return
    const { files, nameFilter, leaves } = this.scopeFor(request)
    const vitest = resolveVitest(projectDir)
    const run = this.controller.createTestRun(request)
    if (vitest.kind === "not-found") {
      for (const item of leaves) {
        run.errored(item, new vscode.TestMessage(vitest.message))
      }
      run.end()
      return
    }
    for (const item of leaves) run.started(item)
    const outputFile = join(tmpdir(), `fr-vitest-debug-${Date.now()}.json`)
    const folder = vscode.workspace.workspaceFolders?.[0]
    const vitestArgs = [
      "run",
      ...files.map((f) => relative(projectDir, f)),
      ...(nameFilter ? ["-t", nameFilter] : []),
      "--reporter=json",
      `--outputFile=${outputFile}`,
    ]
    // Shim → run it as the debuggee executable. Entry fallback → let the
    // js-debug adapter use its own Node (never `process.execPath`, which is
    // Electron in an extension host) with vitest.mjs as the program.
    const launchShape =
      vitest.prefixArgs.length === 0
        ? { runtimeExecutable: vitest.command, args: vitestArgs }
        : { program: vitest.prefixArgs[0], args: vitestArgs }
    const started = await vscode.debug.startDebugging(folder, {
      type: "pwa-node",
      request: "launch",
      name: "Debug pipeline tests",
      cwd: projectDir,
      ...launchShape,
      env: { NO_COLOR: "1" },
      console: "integratedTerminal",
      autoAttachChildProcesses: true,
    })
    if (!started) {
      run.end()
      return
    }
    await new Promise<void>((resolve) => {
      const sub = vscode.debug.onDidTerminateDebugSession(() => {
        sub.dispose()
        resolve()
      })
      token.onCancellationRequested(() => {
        sub.dispose()
        resolve()
      })
    })
    try {
      const summary = parseVitestJson(readFileSync(outputFile, "utf8"))
      if (summary) this.applyRecords(run, summary.records)
    } catch {
      // The session may have been stopped before results were written.
    }
    run.end()
  }

  /** Error `items` AND their descendants on `run`, recording outcomes. */
  private markErrored(
    run: vscode.TestRun,
    items: readonly vscode.TestItem[],
    reason: string,
  ): void {
    const message = new vscode.TestMessage(reason)
    const mark = (item: vscode.TestItem): void => {
      run.errored(item, message)
      this.lastOutcomes.set(item.id, "errored")
      item.children.forEach(mark)
    }
    for (const item of items) mark(item)
  }

  // ── Result mapping (§3.5/§3.6/§5/§6) ────────────────────────────────

  private applyRecords(
    run: vscode.TestRun,
    records: readonly VitestTestRecord[],
  ): void {
    for (const record of records) {
      const item = this.itemFor(record)
      if (!item) continue
      this.lastOutcomes.set(item.id, record.state)
      switch (record.state) {
        case "pass": {
          clearSqlFailure(item.id)
          run.passed(item, record.duration)
          break
        }
        case "skip": {
          run.skipped(item)
          break
        }
        case "fail": {
          run.failed(item, this.failureMessages(item, record), record.duration)
          break
        }
      }
    }
  }

  /** Match by file + full concatenated title; an unmatched (dynamic-title)
   *  result becomes a synthetic child of its file so it is never lost. */
  private itemFor(record: VitestTestRecord): vscode.TestItem | undefined {
    const fileItem = this.fileItemFor(record.file)
    if (!fileItem) return undefined
    const segments = record.fullName.split(" > ")
    let current: vscode.TestItem = fileItem
    for (const segment of segments) {
      let next: vscode.TestItem | undefined
      current.children.forEach((child) => {
        if (child.label === segment) next = child
      })
      if (!next) {
        const id = `${fileItem.id}#${record.fullName} (synthetic)`
        let synthetic = fileItem.children.get(id)
        if (!synthetic) {
          synthetic = this.controller.createTestItem(
            id,
            record.fullName,
            fileItem.uri,
          )
          fileItem.children.add(synthetic)
          this.meta.set(synthetic, {
            fileFsPath: record.file,
            titlePath: segments,
            snapshot: false,
            sqlSnapshot: false,
          })
        }
        return synthetic
      }
      current = next
    }
    return current
  }

  private fileItemFor(fsPath: string): vscode.TestItem | undefined {
    // Compare CANONICAL paths: Vitest reports realpath'd absolute file names
    // (macOS `/tmp` → `/private/tmp`), while discovery carries the workspace
    // form — a string compare would silently drop every result.
    const target = canonicalPath(fsPath)
    let found: vscode.TestItem | undefined
    this.controller.items.forEach((group) => {
      group.children.forEach((file) => {
        if (file.uri && canonicalPath(file.uri.fsPath) === target) found = file
      })
    })
    return found
  }

  /** Inline failure messages (§5): located at the failing assertion's line
   *  (from the stack), diff-shaped when expected/received are recoverable,
   *  with a golden-diff command link for SQL snapshot mismatches (§6.4). */
  private failureMessages(
    item: vscode.TestItem,
    record: VitestTestRecord,
  ): vscode.TestMessage[] {
    const meta = this.meta.get(item)
    const messages: vscode.TestMessage[] = []
    for (const raw of record.failureMessages) {
      const text = stripAnsi(raw)
      // The diff body: from the failure message when present, else joined
      // from the default reporter's stdout via the backticked snapshot name
      // (the JSON reporter strips failures to message+stack).
      let sides = isSnapshotMismatch(text) ? extractSnapshotSides(text) : null
      if (!sides && isSnapshotMismatch(text)) {
        const name = snapshotNameOf(text)
        if (name) sides = extractSidesFromOutput(this.lastRunOutput, name)
      }
      let message: vscode.TestMessage
      if (sides && meta?.sqlSnapshot) {
        setSqlFailure(item.id, sides)
        const md = new vscode.MarkdownString(
          `${fence(firstLine(text))}\n\n[Open SQL golden diff](command:flinkReactor.openSqlGoldenDiff?${encodeURIComponent(
            JSON.stringify([item.id]),
          )})`,
        )
        md.isTrusted = {
          enabledCommands: ["flinkReactor.openSqlGoldenDiff"],
        }
        message = new vscode.TestMessage(md)
        message.expectedOutput = sides.expected
        message.actualOutput = sides.received
      } else if (sides) {
        // Non-SQL snapshot (e.g. a CRD object): inline diff only (task 6.5).
        message = vscode.TestMessage.diff(
          firstLine(text),
          sides.expected,
          sides.received,
        )
      } else {
        message = new vscode.TestMessage(text)
      }
      const line = assertionLine(text, meta?.fileFsPath)
      if (item.uri) {
        message.location = new vscode.Location(
          item.uri,
          new vscode.Position(line ?? item.range?.start.line ?? 0, 0),
        )
      }
      messages.push(message)
    }
    if (messages.length === 0) {
      messages.push(new vscode.TestMessage("Test failed (no failure detail)."))
    }
    return messages
  }

  // ── Update snapshots (§7) ───────────────────────────────────────────

  /**
   * Bless intended snapshot changes: re-run Vitest with `--update`, scoped
   * to `items` (or every discovered pipeline test for the project-wide
   * command). The `--update` run's own outcomes map back onto the tree —
   * rewritten snapshots report as passing — and any open SQL golden-diff
   * for an updated test closes (its mismatch premise no longer holds).
   */
  async updateSnapshots(items?: readonly vscode.TestItem[]): Promise<void> {
    const include = items && items.length > 0 ? [...items] : undefined
    const request = new vscode.TestRunRequest(include)
    const source = new vscode.CancellationTokenSource()
    await this.runOnce(request, source.token, { update: true })
    for (const item of include ?? this.allFileItems()) {
      await this.closeDiffsUnder(item)
    }
  }

  private async closeDiffsUnder(item: vscode.TestItem): Promise<void> {
    await closeSqlGoldenDiff(item.id)
    const children: vscode.TestItem[] = []
    item.children.forEach((child) => {
      children.push(child)
    })
    for (const child of children) await this.closeDiffsUnder(child)
  }

  // ── Programmatic run entry (the test CodeLens — §8.2) ──────────────

  /** Items for a file uri, optionally narrowed to one full title path. */
  findItems(uri: vscode.Uri, fullTitle?: string): vscode.TestItem[] {
    const fileItem = this.fileItemFor(uri.fsPath)
    if (!fileItem) return []
    if (!fullTitle) return [fileItem]
    const matches: vscode.TestItem[] = []
    const walk = (item: vscode.TestItem): void => {
      const meta = this.meta.get(item)
      if (meta && meta.titlePath.join(" > ") === fullTitle) matches.push(item)
      item.children.forEach(walk)
    }
    fileItem.children.forEach(walk)
    return matches
  }

  /** Run or debug a set of items (what a test CodeLens click drives). */
  async runItems(
    items: readonly vscode.TestItem[],
    debug: boolean,
  ): Promise<void> {
    if (items.length === 0) return
    const request = new vscode.TestRunRequest([...items])
    const source = new vscode.CancellationTokenSource()
    if (debug) await this.debugHandler(request, source.token)
    else await this.runOnce(request, source.token)
  }

  // ── e2e observability (no cross-extension Test API enumeration) ─────

  /** Flattened snapshot of every discovered item. */
  snapshotItems(): TestItemSnapshot[] {
    const out: TestItemSnapshot[] = []
    const walk = (item: vscode.TestItem): void => {
      out.push({
        id: item.id,
        label: item.label,
        ...(item.range ? { line: item.range.start.line } : {}),
        tags: item.tags.map((t) => t.id),
      })
      item.children.forEach(walk)
    }
    this.controller.items.forEach(walk)
    return out
  }

  /** Whether the continuous (`vitest --watch`) process is live. */
  get watchActive(): boolean {
    return this.watchChild !== undefined
  }

  /** Start the continuous watch programmatically (the e2e path — the Test
   *  Explorer's watch toggle builds the same continuous request). */
  startWatchForTests(): void {
    this.watchCancel = new vscode.CancellationTokenSource()
    const request = new vscode.TestRunRequest(
      undefined,
      undefined,
      undefined,
      true,
    )
    this.startWatch(request, this.watchCancel.token)
  }

  /** Cancel the continuous watch (the stop affordance — §9.3). */
  stopWatchForTests(): void {
    this.watchCancel?.cancel()
    this.watchCancel = undefined
  }

  private output(): vscode.OutputChannel {
    this.testOutput ??= vscode.window.createOutputChannel(
      "FlinkReactor Pipeline Tests",
    )
    return this.testOutput
  }

  dispose(): void {
    this.watchChild?.kill()
    for (const d of this.disposables.splice(0)) d.dispose()
    this.testOutput?.dispose()
    this.controller.dispose()
    getOutputChannel().info("Pipeline test controller disposed")
  }
}

const canonicalCache = new Map<string, string>()

function canonicalPath(p: string): string {
  const hit = canonicalCache.get(p)
  if (hit) return hit
  let resolved: string
  try {
    resolved = realpathSync(p)
  } catch {
    resolved = p
  }
  canonicalCache.set(p, resolved)
  return resolved
}

/** 0-based line of the failing assertion inside the TEST file, parsed from
 *  the failure's stack frames. */
function assertionLine(
  message: string,
  fileFsPath: string | undefined,
): number | undefined {
  if (!fileFsPath) return undefined
  // Stack frames carry the realpath'd file name; try both forms.
  for (const candidate of new Set([fileFsPath, canonicalPath(fileFsPath)])) {
    const pattern = new RegExp(
      `at .*${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+):\\d+`,
    )
    const match = pattern.exec(message)
    if (match?.[1]) return Math.max(0, Number(match[1]) - 1)
  }
  return undefined
}

function firstLine(text: string): string {
  return text.split("\n", 1)[0] ?? text
}

function fence(text: string): string {
  return text.replace(/`/g, "\\`")
}
