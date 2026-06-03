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
  type PreviewBlock,
  type Segment,
  segment,
} from "../blocks.js"
import type { SynthPipeline } from "../protocol.js"

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
const blocksEl = document.getElementById("blocks") as HTMLDivElement
const emptyEl = document.getElementById("empty") as HTMLDivElement

/** Above this many blocks, populate statement bodies lazily on scroll rather
 *  than all at once (task 3.6 — virtualized/lazy rendering for large counts). */
const LAZY_THRESHOLD = 60

/** Inbound messages from the extension host. */
type HostMessage =
  | { type: "synth"; version: number; pipeline: SynthPipeline }
  | { type: "failure"; version: number; error: string }
  | { type: "activeNode"; nodeId: string | null; version: number }

/** The last successfully rendered pipeline — retained so a synthesis failure
 *  shows a stale banner over it instead of blanking the panel. */
let lastBlocks: PreviewBlock[] = []
let renderedVersion = -1
/** The active DSL→SQL node id, re-applied across refreshes when it survives. */
let activeNodeId: string | null = null
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
})

bannerDetailsEl.addEventListener("click", () =>
  vscode.postMessage({ type: "showFailure" }),
)

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
  renderedVersion = version
  lastBlocks = buildBlocks(pipeline)
  render(lastBlocks)
  // Re-apply the active highlight when that node still exists in the new result.
  const active = activeNodeId
  if (active && lastBlocks.some((b) => matchesNode(b, active)))
    applyHighlight(active, { scroll: false })
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
  // Preserve the scroll offset across a re-render (6.2).
  const scrollTop = blocksEl.scrollTop || document.documentElement.scrollTop
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
    window.scrollTo({ top: scrollTop })
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
 *  become clickable `.frag` elements carrying `data-origin`. */
function populate(block: PreviewBlock): void {
  if (populated.has(block.index)) return
  const pre = bodyByIndex.get(block.index)
  if (!pre) return
  for (const seg of segment(block.sql, block.fragments)) {
    pre.appendChild(segmentNode(seg))
  }
  populated.add(block.index)
}

function segmentNode(seg: Segment): Node {
  if (!seg.origin) return document.createTextNode(seg.text)
  const span = document.createElement("span")
  span.className = "frag"
  span.dataset.origin = seg.origin
  span.textContent = seg.text
  return span
}

function sectionDivider(section: string): HTMLElement {
  return el("div", "section-divider", sectionLabel(section))
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
