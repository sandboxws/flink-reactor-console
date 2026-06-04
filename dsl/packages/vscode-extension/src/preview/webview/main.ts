// The SQL-preview webview renderer — a *dumb* renderer: JSON in (the synth
// pipeline + active node id over postMessage), messages out (`revealNode` /
// `requestRefresh`). It never imports the DSL and never sends LSP requests; the
// extension host brokers all of that. Every statement string is inserted as a
// text node, never as HTML, to honor the page CSP.
//
// The view model (block folding, byte-offset → span overlay, hit-testing,
// highlight resolution) lives in the pure, unit-tested `../blocks.ts`; this file
// is just the DOM binding + message pump + lazy rendering.

import {
  blockMatches,
  buildBlocks,
  noSqlMessage,
  type PreviewBlock,
  segment,
} from "../blocks.js"
import type { SynthPipeline } from "../protocol.js"
import { tokenize } from "../sql-highlight.js"

interface VsCodeApi {
  postMessage(message: unknown): void
}
declare function acquireVsCodeApi(): VsCodeApi

const vscode = acquireVsCodeApi()

const bannerEl = document.getElementById("banner") as HTMLDivElement
const bannerTextEl = document.getElementById("banner-text") as HTMLSpanElement
const bannerDetailsEl = document.getElementById(
  "banner-details",
) as HTMLButtonElement
const contentEl = document.getElementById("content") as HTMLDivElement
const blocksEl = document.getElementById("blocks") as HTMLDivElement
const emptyEl = document.getElementById("empty") as HTMLDivElement
const modeToggleEl = document.getElementById("mode-toggle") as HTMLButtonElement
const refreshEl = document.getElementById("refresh") as HTMLButtonElement
const pendingEl = document.getElementById("pending") as HTMLSpanElement

/** Above this many blocks, populate statement bodies lazily on scroll rather
 *  than all at once (task 3.6 — virtualized/lazy rendering for large counts). */
const LAZY_THRESHOLD = 60

/** Inbound messages from the extension host. */
type HostMessage =
  | { type: "synth"; version: number; pipeline: SynthPipeline }
  | { type: "failure"; version: number; error: string }
  | { type: "activeNode"; nodeId: string | null; version: number }
  | { type: "sync"; mode: SyncMode; pending: boolean }

type SyncMode = "auto" | "manual"

/** The last successfully rendered pipeline — retained so a synthesis failure
 *  shows a stale banner over it instead of blanking the panel. */
let lastBlocks: PreviewBlock[] = []
let renderedVersion = -1
/** The active DSL→SQL node id, re-applied across refreshes when it survives. */
let activeNodeId: string | null = null
/** Current sync mode, mirrored from the host so the toggle label is correct. */
let syncMode: SyncMode = "auto"
/** Lazy population bookkeeping: block index → its `<pre>` body element. */
const bodyByIndex = new Map<number, HTMLElement>()
const populated = new Set<number>()
let observer: IntersectionObserver | undefined

// ── Message pump ────────────────────────────────────────────────────

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as HostMessage
  if (msg.type === "synth") onSynth(msg.pipeline, msg.version)
  else if (msg.type === "failure") onFailure(msg.error)
  else if (msg.type === "activeNode") onActiveNode(msg.nodeId, msg.version)
  else if (msg.type === "sync") onSync(msg.mode, msg.pending)
})

bannerDetailsEl.addEventListener("click", () =>
  vscode.postMessage({ type: "showFailure" }),
)

// Sync controls. The toggle flips auto⇄manual; Refresh re-pulls on demand (the
// primary action in manual mode). The host owns the state and echoes it back via
// a `sync` message, so the button label always reflects the real mode.
modeToggleEl.addEventListener("click", () =>
  vscode.postMessage({
    type: "setSyncMode",
    mode: syncMode === "auto" ? "manual" : "auto",
  }),
)
refreshEl.addEventListener("click", () =>
  vscode.postMessage({ type: "requestRefresh" }),
)

function onSync(mode: SyncMode, pending: boolean): void {
  syncMode = mode
  modeToggleEl.textContent =
    mode === "auto" ? "Auto-sync: On" : "Auto-sync: Off"
  modeToggleEl.classList.toggle("manual", mode === "manual")
  // The "changed — Refresh" hint only applies while paused in manual mode.
  pendingEl.hidden = !(mode === "manual" && pending)
}

// SQL→DSL: one delegated click handler. A click on a contributed span resolves
// to that fragment's node; a click elsewhere in a block resolves to the block's
// whole-statement origin; a statement with neither selects nothing (no error).
blocksEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement
  const frag = target.closest("[data-origin]") as HTMLElement | null
  if (frag?.dataset.origin) {
    vscode.postMessage({ type: "revealNode", nodeId: frag.dataset.origin })
    return
  }
  const block = target.closest(".block") as HTMLElement | null
  const origin = block?.dataset.originStatement
  if (origin) vscode.postMessage({ type: "revealNode", nodeId: origin })
})

// ── Render: fresh SQL ───────────────────────────────────────────────

function onSynth(pipeline: SynthPipeline, version: number): void {
  bannerEl.hidden = true
  // A fresh pull is now current — drop any manual "changed" hint.
  pendingEl.hidden = true
  renderedVersion = version
  lastBlocks = buildBlocks(pipeline)
  if (lastBlocks.length === 0) {
    // Synthesis succeeded but produced no executable SQL (a comment-only
    // pipeline, e.g. a CDC Pipeline Connector whose runtime is in pipeline.yaml).
    // Show a real explanation rather than leaving the "Waiting…" placeholder.
    showNoSqlState(pipeline)
  } else {
    render(lastBlocks)
    // Re-apply the active highlight when that node still exists in the result.
    const active = activeNodeId
    if (active && lastBlocks.some((b) => matchesNode(b, active)))
      applyHighlight(active, { scroll: false })
  }
  vscode.postMessage({
    type: "rendered",
    ok: true,
    version,
    blockCount: lastBlocks.length,
    statementCount: pipeline.statements.length,
  })
}

function onFailure(error: string): void {
  if (lastBlocks.length > 0) {
    // Keep the last good SQL; raise the non-blocking stale banner.
    bannerTextEl.textContent = "Preview is stale — synthesis is failing."
    bannerDetailsEl.hidden = false
    bannerEl.hidden = false
  } else {
    // Nothing good to fall back to — show the error state, not a blank panel.
    showErrorState(error)
  }
  vscode.postMessage({
    type: "rendered",
    ok: false,
    version: renderedVersion,
    blockCount: lastBlocks.length,
    statementCount: 0,
  })
}

function render(blocks: PreviewBlock[]): void {
  // Preserve the scroll offset across a re-render (6.2). `#content` is the
  // scroll container (the body is a flex column with a fixed toolbar).
  const scrollTop = contentEl.scrollTop
  clear(blocksEl)
  bodyByIndex.clear()
  populated.clear()
  observer?.disconnect()
  emptyEl.hidden = blocks.length > 0
  if (blocks.length === 0) return

  let lastSection = ""
  for (const block of blocks) {
    if (block.section && block.section !== lastSection) {
      blocksEl.appendChild(sectionDivider(block.section))
      lastSection = block.section
    }
    blocksEl.appendChild(buildBlockEl(block))
  }

  // Lazy vs. eager body population.
  if (blocks.length <= LAZY_THRESHOLD) {
    for (const block of blocks) populate(block)
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = Number((e.target as HTMLElement).dataset.index)
          const block = blocks.find((b) => b.index === idx)
          if (block) populate(block)
        }
      },
      { rootMargin: "400px 0px" },
    )
    for (const el of blocksEl.querySelectorAll(".block")) observer.observe(el)
  }

  // Restore scroll after layout settles.
  requestAnimationFrame(() => {
    contentEl.scrollTo({ top: scrollTop })
  })
}

function buildBlockEl(block: PreviewBlock): HTMLElement {
  const section = document.createElement("section")
  section.className = "block"
  section.dataset.index = String(block.index)
  if (block.originNodeId) section.dataset.originStatement = block.originNodeId

  const head = document.createElement("div")
  head.className = "block-head"
  head.appendChild(el("span", "block-label", block.label))
  if (block.section)
    head.appendChild(el("span", "block-section", block.section))
  section.appendChild(head)

  const pre = document.createElement("pre")
  pre.className = "block-sql"
  section.appendChild(pre)
  bodyByIndex.set(block.index, pre)
  return section
}

/** Populate a block's `<pre>` with its segmented SQL (idempotent). Origin spans
 *  become clickable `.frag` elements carrying `data-origin`; every segment's text
 *  is then syntax-highlighted inside. */
function populate(block: PreviewBlock): void {
  if (populated.has(block.index)) return
  const pre = bodyByIndex.get(block.index)
  if (!pre) return
  for (const seg of segment(block.sql, block.fragments)) {
    if (seg.origin) {
      const frag = document.createElement("span")
      frag.className = "frag"
      frag.dataset.origin = seg.origin
      appendHighlighted(frag, seg.text)
      pre.appendChild(frag)
    } else {
      appendHighlighted(pre, seg.text)
    }
  }
  populated.add(block.index)
}

/** Tokenize `text` as Flink SQL and append colored token spans (+ plain text
 *  nodes for unclassified runs) to `parent`. Purely decorative: it composes over
 *  the fragment overlay and never carries `data-origin`, so the click/caret
 *  resolution keys off the enclosing `.frag` / `.block` exactly as before — the
 *  token spans are transparent to `closest("[data-origin]")`. */
function appendHighlighted(parent: Node, text: string): void {
  for (const tok of tokenize(text)) {
    if (tok.category) {
      const span = document.createElement("span")
      span.className = `tok-${tok.category}`
      span.textContent = tok.text
      parent.appendChild(span)
    } else {
      parent.appendChild(document.createTextNode(tok.text))
    }
  }
}

const SVG_NS = "http://www.w3.org/2000/svg"

/** Inline-SVG child specs, drawn on a 24×24 grid and stroked in `currentColor`
 *  so each icon inherits the divider's (theme-aware) color. */
interface IconChild {
  readonly tag: "path" | "circle" | "rect" | "line"
  readonly attrs: Readonly<Record<string, string>>
}

// NOTE(curate): the section→icon choices are a product/UX decision. Each maps a
// `SqlSection` to a distinct, recognizable glyph — sliders=config, cylinder=
// catalog, expression-brackets=functions, arrow-into-box=source, arrow-out-of-
// box=sink, eye=view, grid=materialized table, branch=pipeline DAG. Retune by
// swapping the path data; the lookup falls back to a chevron for any new section.
const SECTION_ICONS: Readonly<Record<string, readonly IconChild[]>> = {
  configuration: [
    { tag: "line", attrs: { x1: "4", y1: "9", x2: "20", y2: "9" } },
    { tag: "circle", attrs: { cx: "9", cy: "9", r: "2.4" } },
    { tag: "line", attrs: { x1: "4", y1: "15", x2: "20", y2: "15" } },
    { tag: "circle", attrs: { cx: "15", cy: "15", r: "2.4" } },
  ],
  catalogs: [
    {
      tag: "path",
      attrs: { d: "M5 6c0-1.66 3.13-3 7-3s7 1.34 7 3-3.13 3-7 3-7-1.34-7-3z" },
    },
    { tag: "path", attrs: { d: "M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" } },
    { tag: "path", attrs: { d: "M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" } },
  ],
  functions: [
    { tag: "path", attrs: { d: "M9 8l-4 4 4 4" } },
    { tag: "path", attrs: { d: "M15 8l4 4-4 4" } },
  ],
  sources: [
    { tag: "path", attrs: { d: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" } },
    { tag: "path", attrs: { d: "M10 16l4-4-4-4" } },
    { tag: "line", attrs: { x1: "14", y1: "12", x2: "4", y2: "12" } },
  ],
  sinks: [
    { tag: "path", attrs: { d: "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" } },
    { tag: "path", attrs: { d: "M16 16l4-4-4-4" } },
    { tag: "line", attrs: { x1: "20", y1: "12", x2: "10", y2: "12" } },
  ],
  views: [
    {
      tag: "path",
      attrs: { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" },
    },
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "3" } },
  ],
  "materialized-tables": [
    {
      tag: "rect",
      attrs: { x: "3", y: "4", width: "18", height: "16", rx: "2" },
    },
    { tag: "line", attrs: { x1: "3", y1: "10", x2: "21", y2: "10" } },
    { tag: "line", attrs: { x1: "9", y1: "10", x2: "9", y2: "20" } },
  ],
  pipeline: [
    { tag: "line", attrs: { x1: "6", y1: "3", x2: "6", y2: "15" } },
    { tag: "circle", attrs: { cx: "6", cy: "18", r: "3" } },
    { tag: "circle", attrs: { cx: "18", cy: "6", r: "3" } },
    { tag: "path", attrs: { d: "M18 9a9 9 0 0 1-9 9" } },
  ],
}

/** Generic chevron for a section with no dedicated glyph. */
const FALLBACK_ICON: readonly IconChild[] = [
  { tag: "path", attrs: { d: "M9 6l6 6-6 6" } },
]

/** Build the section's icon as an inline SVG (CSP-safe DOM, not markup). */
function sectionIcon(section: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("class", "section-icon")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "2")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute("aria-hidden", "true")
  for (const child of SECTION_ICONS[section] ?? FALLBACK_ICON) {
    const node = document.createElementNS(SVG_NS, child.tag)
    for (const [k, v] of Object.entries(child.attrs)) node.setAttribute(k, v)
    svg.appendChild(node)
  }
  return svg
}

function sectionDivider(section: string): HTMLElement {
  const div = document.createElement("div")
  div.className = "section-divider"
  div.appendChild(sectionIcon(section))
  div.appendChild(el("span", "", sectionLabel(section)))
  return div
}

/** Map the DSL `SqlSection` to a friendly group heading. */
function sectionLabel(section: string): string {
  switch (section) {
    case "configuration":
      return "Configuration (SET)"
    case "catalogs":
      return "Catalogs"
    case "functions":
      return "Functions"
    case "sources":
      return "Sources (CREATE TABLE)"
    case "sinks":
      return "Sinks (CREATE TABLE)"
    case "views":
      return "Views"
    case "materialized-tables":
      return "Materialized Tables"
    case "pipeline":
      return "Pipeline (INSERT INTO)"
    default:
      return section
  }
}

// ── DSL→SQL highlight ───────────────────────────────────────────────

function onActiveNode(nodeId: string | null, version: number): void {
  // Version skew: the editor moved past what we rendered — ignore the stale
  // cross-highlight and ask for a refresh (4.6). The next synth re-applies it.
  if (version !== renderedVersion) {
    vscode.postMessage({ type: "requestRefresh" })
    return
  }
  activeNodeId = nodeId
  clearHighlight()
  // A node with no statement and no span clears the highlight and highlights
  // nothing (4.5) — the ack then reports zero counts.
  const counts = nodeId
    ? applyHighlight(nodeId, { scroll: true })
    : { wholeCount: 0, spanCount: 0 }
  vscode.postMessage({ type: "highlighted", nodeId, ...counts })
}

/** Apply the DSL→SQL highlight for `nodeId`, returning how many whole statements
 *  and sub-statement spans lit up (the e2e observes these via the host). */
function applyHighlight(
  nodeId: string,
  opts: { scroll: boolean },
): { wholeCount: number; spanCount: number } {
  clearHighlight()
  let firstHit: HTMLElement | undefined
  let wholeCount = 0
  let spanCount = 0
  for (const block of lastBlocks) {
    const { whole, spans } = blockMatches(block, nodeId)
    if (!whole && spans.length === 0) continue
    populate(block) // ensure spans exist even if lazily deferred
    const section = blocksEl.querySelector(
      `.block[data-index="${block.index}"]`,
    ) as HTMLElement | null
    if (!section) continue
    if (whole) {
      section.classList.add("active-whole")
      wholeCount++
      firstHit ??= section
    }
    for (const frag of section.querySelectorAll<HTMLElement>(".frag")) {
      if (frag.dataset.origin === nodeId) {
        frag.classList.add("active")
        spanCount++
        firstHit ??= frag
      }
    }
  }
  if (opts.scroll && firstHit)
    firstHit.scrollIntoView({ block: "nearest", behavior: "smooth" })
  return { wholeCount, spanCount }
}

function clearHighlight(): void {
  for (const el of blocksEl.querySelectorAll(".active-whole"))
    el.classList.remove("active-whole")
  for (const el of blocksEl.querySelectorAll(".frag.active"))
    el.classList.remove("active")
}

function matchesNode(block: PreviewBlock, nodeId: string): boolean {
  const { whole, spans } = blockMatches(block, nodeId)
  return whole || spans.length > 0
}

// ── Error / empty state ─────────────────────────────────────────────

/** Successful synth with no SQL to show (every statement is a `--` banner —
 *  e.g. a CDC Pipeline Connector). Replace the "Waiting…" placeholder with a
 *  real message so this never reads as a stuck synthesis. */
function showNoSqlState(pipeline: SynthPipeline): void {
  bannerEl.hidden = true
  clear(blocksEl)
  emptyEl.hidden = false
  clear(emptyEl)
  const { heading, detail } = noSqlMessage(pipeline)
  emptyEl.appendChild(el("div", "no-sql-heading", heading))
  if (detail) emptyEl.appendChild(el("pre", "no-sql-detail", detail))
}

function showErrorState(error: string): void {
  bannerEl.hidden = true
  clear(blocksEl)
  emptyEl.hidden = false
  clear(emptyEl)
  emptyEl.appendChild(el("div", "", "Synthesis failed — no SQL to preview."))
  const pre = document.createElement("pre")
  pre.textContent = error
  emptyEl.appendChild(pre)
}

// ── Helpers ─────────────────────────────────────────────────────────

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
