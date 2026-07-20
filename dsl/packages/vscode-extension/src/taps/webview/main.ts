// The tap-panel webview renderer (tap-visualization, Tier-3 feature 13) — a
// *dumb* renderer: JSON in (the tap manifest over postMessage), messages out
// (`tapClicked` / `requestRefresh`). It never imports the DSL and never sends
// LSP requests; the extension host brokers all of that. Every manifest string
// (including `observationSql`) is inserted as TEXT, never as HTML, honoring
// the page CSP.

import type { TapManifestResponse, TapView } from "../protocol.js"

interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}
declare function acquireVsCodeApi(): VsCodeApi

const vscode = acquireVsCodeApi()

const statusEl = document.getElementById("status") as HTMLDivElement
const consoleEl = document.getElementById("console-target") as HTMLDivElement
const emptyEl = document.getElementById("empty") as HTMLDivElement
const tapsEl = document.getElementById("taps") as HTMLDivElement

/** The last successfully rendered manifest — kept so a failed synthesis dims
 *  it rather than blanking the panel. */
let lastGood: TapManifestResponse | undefined
/** Highest version rendered — stale in-flight responses are ignored. */
let renderedVersion = -1
/** Tap ids present in the last render, to animate in only the added ones. */
let previousIds = new Set<string>()

/**
 * The human strategy label, derived from the tap's `connectorType` the same
 * way the DSL's `resolveObservationStrategy` (src/core/tap.ts) classifies it.
 * The label is a presentation summary — `observationSql` stays authoritative.
 */
function strategyFor(connectorType: string): string {
  switch (connectorType) {
    case "kafka":
    case "upsert-kafka":
      return "consumer-group-clone"
    case "jdbc":
      return "periodic-poll"
    case "paimon":
    case "iceberg":
      return "incremental-read"
    case "datagen":
      return "direct-read"
    default:
      return "direct-read"
  }
}

// ── Message pump ────────────────────────────────────────────────────

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as { type: string; manifest?: TapManifestResponse }
  if (msg.type === "manifest" && msg.manifest) applyManifest(msg.manifest)
})

function applyManifest(manifest: TapManifestResponse): void {
  if (!manifest.ok) {
    // Graceful degradation: show the error, dim the last good taps.
    statusEl.textContent = `⚠ ${manifest.error ?? "Synthesis failed."}`
    statusEl.hidden = false
    tapsEl.classList.add("dimmed")
    ack(false, manifest.version)
    return
  }
  // Ignore a stale response that lost the race against a newer render.
  if (manifest.version < renderedVersion) return
  renderedVersion = manifest.version
  statusEl.hidden = true
  tapsEl.classList.remove("dimmed")
  lastGood = manifest
  render(manifest)
  ack(true, manifest.version)
}

function ack(ok: boolean, version: number): void {
  vscode.postMessage({
    type: "rendered",
    ok,
    version,
    tapCount: lastGood?.taps.length ?? 0,
    autoTapCount: lastGood?.taps.filter((t) => t.autoTap).length ?? 0,
  })
}

// ── Rendering (all content as text nodes — never HTML) ─────────────

function render(manifest: TapManifestResponse): void {
  renderConsoleTarget(manifest.consoleUrl)

  const taps = manifest.taps
  emptyEl.hidden = taps.length > 0
  if (taps.length === 0) {
    // 4.5 — the non-error empty state: how to tap an operator.
    emptyEl.replaceChildren()
    emptyEl.append("No operators are tapped in this pipeline. Add ")
    emptyEl.append(code("tap={true}"))
    emptyEl.append(" (or ")
    emptyEl.append(code('tap={{ name: "my-tap" }}'))
    emptyEl.append(
      ") to a source, sink, or transform to generate a read-only observation query.",
    )
    tapsEl.replaceChildren()
    previousIds = new Set()
    return
  }

  // Diff by nodeId: unchanged taps keep their DOM position; only added
  // entries animate in (stable identity across the debounced refreshes).
  const nextIds = new Set(taps.map((t) => t.nodeId))
  tapsEl.replaceChildren(
    ...taps.map((tap) => buildTapEntry(tap, !previousIds.has(tap.nodeId))),
  )
  previousIds = nextIds
}

function renderConsoleTarget(consoleUrl: string | undefined): void {
  consoleEl.replaceChildren()
  if (consoleUrl) {
    consoleEl.append("Taps push to ")
    consoleEl.append(code(consoleUrl))
    consoleEl.append(" (")
    consoleEl.append(code(`${consoleUrl.replace(/\/$/, "")}/api/tap-manifests`))
    consoleEl.append(")")
  } else {
    consoleEl.append(
      "No console configured — set flinkReactor.consoleUrl to push tap manifests.",
    )
  }
}

function buildTapEntry(tap: TapView, isNew: boolean): HTMLDivElement {
  const entry = document.createElement("div")
  entry.className = isNew ? "tap added" : "tap"
  entry.dataset.nodeId = tap.nodeId

  // Header: operator + tap name + strategy/auto badges; click → reveal JSX.
  const head = document.createElement("div")
  head.className = "head"
  head.title = "Reveal the originating JSX"
  const op = document.createElement("span")
  op.className = "op"
  op.textContent = tap.componentName
  head.appendChild(op)
  const name = document.createElement("span")
  name.className = "tapname"
  name.textContent = tap.name
  head.appendChild(name)
  const strategy = document.createElement("span")
  strategy.className = "badge strategy"
  strategy.textContent = strategyFor(tap.connectorType)
  head.appendChild(strategy)
  const kind = document.createElement("span")
  kind.className = tap.autoTap ? "badge auto" : "badge explicit"
  kind.textContent = tap.autoTap ? "auto-tap" : "tap"
  head.appendChild(kind)
  head.addEventListener("click", () => {
    vscode.postMessage({ type: "tapClicked", nodeId: tap.nodeId })
  })
  entry.appendChild(head)

  // Consumer group.
  const meta = document.createElement("div")
  meta.className = "meta"
  meta.append("consumer group ")
  meta.append(code(tap.consumerGroupId))
  entry.appendChild(meta)

  // Tapped output schema.
  if (tap.schema.length > 0) {
    const table = document.createElement("table")
    for (const column of tap.schema) {
      const row = document.createElement("tr")
      const nameCell = document.createElement("td")
      nameCell.textContent = column.name
      const typeCell = document.createElement("td")
      typeCell.className = "type"
      typeCell.textContent = column.type
      row.append(nameCell, typeCell)
      table.appendChild(row)
    }
    entry.appendChild(table)
  }

  // Observation SQL — collapsed by default, inserted as text.
  const details = document.createElement("details")
  const summary = document.createElement("summary")
  summary.textContent = "Observation SQL"
  details.appendChild(summary)
  const pre = document.createElement("pre")
  pre.textContent = tap.observationSql
  details.appendChild(pre)
  entry.appendChild(details)

  return entry
}

function code(text: string): HTMLElement {
  const el = document.createElement("code")
  el.textContent = text
  return el
}

// Ask the host for the initial manifest (it also pushes on re-synthesis).
vscode.postMessage({ type: "requestRefresh" })
