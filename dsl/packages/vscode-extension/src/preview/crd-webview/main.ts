// The CRD-preview webview renderer — a *dumb* renderer: JSON in (the artifact
// set over postMessage), messages out (`copy` / `save` / `saveAll` /
// `requestRefresh`). It never imports the DSL and never sends LSP requests; the
// extension host brokers all of that. Every YAML line is inserted as text
// nodes (highlight spans + text), never as HTML, to honor the page CSP.
//
// The YAML tokenizer lives in the pure, unit-tested `../crd-blocks.ts`; this
// file is the DOM binding + message pump + tab state. Only the *active* tab's
// YAML is tokenized (lazy rendering for large artifact sets), and the active
// tab + scroll are preserved when a refresh produces the same set of tabs.

import { highlightYamlLine, type YamlSegment } from "../crd-blocks.js"
import type {
  CrdArtifact,
  CrdPreviewPipeline,
  PipelineKind,
} from "../crd-protocol.js"

interface VsCodeApi {
  postMessage(message: unknown): void
}
declare function acquireVsCodeApi(): VsCodeApi

const vscode = acquireVsCodeApi()

const nameEl = document.getElementById("pipeline-name") as HTMLSpanElement
const kindEl = document.getElementById("kind-label") as HTMLSpanElement
const saveAllEl = document.getElementById("save-all") as HTMLButtonElement
const bannerEl = document.getElementById("banner") as HTMLDivElement
const bannerTextEl = document.getElementById("banner-text") as HTMLSpanElement
const bannerDetailsEl = document.getElementById(
  "banner-details",
) as HTMLButtonElement
const tabsEl = document.getElementById("tabs") as HTMLDivElement
const toolbarEl = document.getElementById("toolbar") as HTMLDivElement
const filenameEl = document.getElementById("active-filename") as HTMLSpanElement
const copyEl = document.getElementById("copy") as HTMLButtonElement
const saveEl = document.getElementById("save") as HTMLButtonElement
const yamlEl = document.getElementById("yaml") as HTMLPreElement
const emptyEl = document.getElementById("empty") as HTMLDivElement

/** Inbound messages from the extension host. */
type HostMessage =
  | {
      type: "render"
      version: number
      stale: boolean
      pipeline: CrdPreviewPipeline
      error?: string
    }
  | { type: "error"; error: string }
  | { type: "empty" }
  | { type: "selectTab"; index: number }

// ── Rendered state ──────────────────────────────────────────────────
let artifacts: readonly CrdArtifact[] = []
let activeIndex = 0
let renderedVersion = -1
let pipelineName = ""
let pipelineKind: PipelineKind = "standard"

// ── Message pump ────────────────────────────────────────────────────
window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as HostMessage
  if (msg.type === "render") onRender(msg.pipeline, msg.version, msg.stale)
  else if (msg.type === "error") showErrorState(msg.error)
  else if (msg.type === "empty") showWaitingState()
  else if (msg.type === "selectTab") selectTab(msg.index)
})

saveAllEl.addEventListener("click", () =>
  vscode.postMessage({ type: "saveAll" }),
)
copyEl.addEventListener("click", () => {
  const a = artifacts[activeIndex]
  if (a) vscode.postMessage({ type: "copy", artifactId: a.id })
})
saveEl.addEventListener("click", () => {
  const a = artifacts[activeIndex]
  if (a) vscode.postMessage({ type: "save", artifactId: a.id })
})
bannerDetailsEl.addEventListener("click", () =>
  vscode.postMessage({ type: "showError" }),
)

// ── Render the artifact set ─────────────────────────────────────────

function onRender(
  pipeline: CrdPreviewPipeline,
  version: number,
  stale: boolean,
): void {
  renderedVersion = version
  pipelineName = pipeline.pipelineName
  pipelineKind = pipeline.pipelineKind
  renderHeader()
  setBanner(stale)

  const nextIds = pipeline.artifacts.map((a) => a.id)
  const sameSet = idsEqual(
    nextIds,
    artifacts.map((a) => a.id),
  )

  if (sameSet && artifacts.length > 0) {
    // Structurally unchanged: patch contents in place, preserve active tab +
    // scroll (only the active tab is re-tokenized).
    const scrollTop = yamlEl.scrollTop
    artifacts = pipeline.artifacts
    renderTabs()
    renderActiveYaml()
    yamlEl.scrollTop = scrollTop
  } else {
    // Tab set changed: keep the active artifact if its id survived, else reset.
    const keepId = artifacts[activeIndex]?.id
    artifacts = pipeline.artifacts
    const survived = keepId ? nextIds.indexOf(keepId) : -1
    activeIndex = survived >= 0 ? survived : 0
    renderTabs()
    renderActiveYaml()
    yamlEl.scrollTop = 0
  }

  const hasTabs = artifacts.length > 0
  emptyEl.hidden = hasTabs
  yamlEl.hidden = !hasTabs
  toolbarEl.hidden = !hasTabs
  ack(true)
}

function renderHeader(): void {
  nameEl.textContent = pipelineName
  // 3.3 — label the artifact set explicitly so the author is never confused
  // about why a FlinkDeployment tab is or is not present.
  kindEl.textContent =
    pipelineKind === "cdc-pipeline"
      ? "Flink CDC pipeline · pipeline.yaml + ConfigMap"
      : "Standard SQL pipeline · FlinkDeployment + ConfigMap"
}

function setBanner(stale: boolean): void {
  if (stale) {
    bannerTextEl.textContent =
      "Preview is stale — synthesis is failing. Showing the last-good artifacts."
    bannerEl.hidden = false
  } else {
    bannerEl.hidden = true
  }
}

function renderTabs(): void {
  clear(tabsEl)
  artifacts.forEach((a, i) => {
    const tab = document.createElement("div")
    tab.className = i === activeIndex ? "tab active" : "tab"
    tab.setAttribute("role", "tab")
    tab.dataset.index = String(i)
    tab.appendChild(el("span", "tab-label", a.label))
    tab.appendChild(el("span", "tab-kind", a.kind))
    tab.addEventListener("click", () => selectTab(i))
    tabsEl.appendChild(tab)
  })
}

function selectTab(index: number): void {
  if (index < 0 || index >= artifacts.length || index === activeIndex) return
  activeIndex = index
  for (const tab of tabsEl.querySelectorAll<HTMLElement>(".tab")) {
    tab.classList.toggle("active", Number(tab.dataset.index) === activeIndex)
  }
  renderActiveYaml()
  yamlEl.scrollTop = 0
  ack(true)
}

/** Tokenize + render only the active tab's YAML (3.4 — lazy for large sets). */
function renderActiveYaml(): void {
  const artifact = artifacts[activeIndex]
  clear(yamlEl)
  if (!artifact) return
  filenameEl.textContent = artifact.filename
  const lines = artifact.yaml.split("\n")
  for (let i = 0; i < lines.length; i++) {
    for (const seg of highlightYamlLine(lines[i]))
      yamlEl.appendChild(segNode(seg))
    if (i < lines.length - 1) yamlEl.appendChild(document.createTextNode("\n"))
  }
}

function segNode(seg: YamlSegment): Node {
  if (!seg.cls) return document.createTextNode(seg.text)
  const span = document.createElement("span")
  span.className = `y-${seg.cls}`
  span.textContent = seg.text
  return span
}

// ── Error / waiting states ──────────────────────────────────────────

function showErrorState(error: string): void {
  bannerEl.hidden = true
  toolbarEl.hidden = true
  yamlEl.hidden = true
  clear(tabsEl)
  artifacts = []
  emptyEl.hidden = false
  clear(emptyEl)
  emptyEl.appendChild(
    el("div", "", "Synthesis failed — no artifacts to preview."),
  )
  const pre = document.createElement("pre")
  pre.textContent = error
  emptyEl.appendChild(pre)
  ack(false)
}

function showWaitingState(): void {
  // Only blank to the waiting state when nothing good is on screen.
  if (artifacts.length > 0) return
  bannerEl.hidden = true
  toolbarEl.hidden = true
  yamlEl.hidden = true
  emptyEl.hidden = false
  clear(emptyEl)
  emptyEl.appendChild(el("div", "", "Waiting for the pipeline to synthesize…"))
}

// ── Helpers ─────────────────────────────────────────────────────────

function ack(ok: boolean): void {
  vscode.postMessage({
    type: "rendered",
    ok,
    version: renderedVersion,
    pipelineName,
    pipelineKind,
    tabCount: artifacts.length,
    activeTab: activeIndex,
    activeFilename: artifacts[activeIndex]?.filename ?? "",
  })
}

function idsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

function el(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.textContent = text
  return node
}

function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

// Ask the host for the first model as soon as the script is live.
vscode.postMessage({ type: "ready" })
