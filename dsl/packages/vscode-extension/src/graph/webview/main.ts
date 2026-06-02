// The DAG webview renderer — a *dumb* renderer: JSON in (the graph model over
// postMessage), messages out (`nodeClicked` / `requestRefresh`). It never
// imports the DSL and never sends LSP requests; the extension host brokers all
// of that. Every model string is inserted as text/SVG, never as HTML, to honor
// the page CSP.

import { kindColor } from "../palette.js"
import type {
  GraphModelEdge,
  GraphModelNode,
  GraphModelResponse,
} from "../protocol.js"
import { computeLayout, type Layout } from "./layout.js"

interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}
declare function acquireVsCodeApi(): VsCodeApi

const SVG_NS = "http://www.w3.org/2000/svg"
const vscode = acquireVsCodeApi()

const statusEl = document.getElementById("status") as HTMLDivElement
const emptyEl = document.getElementById("empty") as HTMLDivElement
const canvas = document.getElementById("canvas") as unknown as SVGSVGElement
const hoverEl = document.getElementById("hover") as HTMLDivElement

/** The last successfully rendered model — kept so a failed synthesis can dim it
 *  rather than blank the panel. */
let lastGood: GraphModelResponse | undefined
/** Node ids present in the last render, to fade in only the newly added ones. */
let previousIds = new Set<string>()
/** The selected node id, preserved across refreshes for stable selection. */
let selectedId: string | undefined

// ── Message pump ────────────────────────────────────────────────────

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as { type: string; model?: GraphModelResponse }
  if (msg.type === "model" && msg.model) applyModel(msg.model)
})

function applyModel(model: GraphModelResponse): void {
  if (!model.ok) {
    // Graceful degradation: surface the error, dim the last good graph.
    showStatus(model.error ?? "Synthesis failed.")
    canvas.classList.add("dimmed")
    // Acknowledge so the host knows the error state is shown (the last good
    // node count, if any, is preserved on screen).
    vscode.postMessage({
      type: "rendered",
      ok: false,
      version: model.version,
      nodeCount: lastGood?.nodes.length ?? 0,
    })
    return
  }
  statusEl.hidden = true
  canvas.classList.remove("dimmed")
  lastGood = model
  render(model)
  vscode.postMessage({
    type: "rendered",
    ok: true,
    version: model.version,
    nodeCount: model.nodes.length,
  })
}

function showStatus(message: string): void {
  statusEl.textContent = `⚠ ${message}`
  statusEl.hidden = false
}

// ── Rendering ───────────────────────────────────────────────────────

function render(model: GraphModelResponse): void {
  const hasNodes = model.nodes.length > 0
  emptyEl.hidden = hasNodes
  clear(canvas)
  if (!hasNodes) {
    previousIds = new Set()
    return
  }

  const layout = computeLayout(model.nodes, model.edges)
  canvas.setAttribute("width", String(layout.width))
  canvas.setAttribute("height", String(layout.height))
  canvas.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`)

  canvas.appendChild(buildDefs())
  // Edges first so nodes paint over the endpoints.
  for (const edge of model.edges) {
    const path = buildEdge(edge, layout)
    if (path) canvas.appendChild(path)
  }
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]))
  const nextIds = new Set<string>()
  for (const node of model.nodes) {
    const placed = layout.nodes.get(node.id)
    if (!placed) continue
    nextIds.add(node.id)
    const g = buildNode(node, placed, model, !previousIds.has(node.id))
    canvas.appendChild(g)
  }
  // Drop selection if the node vanished (identity churn).
  if (selectedId && !nodeById.has(selectedId)) selectedId = undefined
  previousIds = nextIds
}

function buildDefs(): SVGDefsElement {
  const defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement
  defs.appendChild(
    arrowMarker(
      "fr-arrow",
      "var(--vscode-editorIndentGuide-activeBackground, #888)",
    ),
  )
  defs.appendChild(
    arrowMarker(
      "fr-arrow-cross",
      "var(--vscode-editorError-foreground, #f44336)",
    ),
  )
  return defs
}

function arrowMarker(id: string, fill: string): SVGMarkerElement {
  const marker = document.createElementNS(SVG_NS, "marker") as SVGMarkerElement
  marker.setAttribute("id", id)
  marker.setAttribute("viewBox", "0 0 10 10")
  marker.setAttribute("refX", "9")
  marker.setAttribute("refY", "5")
  marker.setAttribute("markerWidth", "7")
  marker.setAttribute("markerHeight", "7")
  marker.setAttribute("orient", "auto-start-reverse")
  const path = document.createElementNS(SVG_NS, "path")
  path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z")
  path.setAttribute("fill", fill)
  marker.appendChild(path)
  return marker
}

function buildEdge(
  edge: GraphModelEdge,
  layout: Layout,
): SVGPathElement | null {
  const a = layout.nodes.get(edge.from)
  const b = layout.nodes.get(edge.to)
  if (!a || !b) return null
  const x1 = a.x + a.w
  const y1 = a.y + a.h / 2
  const x2 = b.x
  const y2 = b.y + b.h / 2
  const mx = (x1 + x2) / 2
  const path = document.createElementNS(SVG_NS, "path") as SVGPathElement
  path.setAttribute(
    "d",
    `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
  )
  path.setAttribute("class", edge.crossNode ? "fr-edge cross" : "fr-edge")
  path.setAttribute(
    "marker-end",
    edge.crossNode ? "url(#fr-arrow-cross)" : "url(#fr-arrow)",
  )
  if (edge.crossNode) {
    const title = document.createElementNS(SVG_NS, "title")
    title.textContent = "Changelog-incompatible connection"
    path.appendChild(title)
  }
  return path
}

function buildNode(
  node: GraphModelNode,
  placed: { x: number; y: number; w: number; h: number },
  model: GraphModelResponse,
  isNew: boolean,
): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement
  g.setAttribute(
    "class",
    node.id === selectedId ? "fr-node selected" : "fr-node",
  )
  g.setAttribute("transform", `translate(${placed.x}, ${placed.y})`)
  g.dataset.nodeId = node.id

  const rect = document.createElementNS(SVG_NS, "rect")
  rect.setAttribute("width", String(placed.w))
  rect.setAttribute("height", String(placed.h))
  rect.setAttribute("rx", "6")
  rect.setAttribute("ry", "6")
  rect.setAttribute("fill", kindColor(node.kind))
  g.appendChild(rect)

  const kindText = document.createElementNS(SVG_NS, "text")
  kindText.setAttribute("class", "kindlabel")
  kindText.setAttribute("x", "10")
  kindText.setAttribute("y", "16")
  kindText.textContent = node.kind
  g.appendChild(kindText)

  const label = document.createElementNS(SVG_NS, "text")
  label.setAttribute("x", "10")
  label.setAttribute("y", "33")
  label.textContent = truncate(node.label, 22)
  g.appendChild(label)

  const badge = buildBadge(node, placed.w)
  if (badge) g.appendChild(badge)

  g.addEventListener("click", () => {
    selectedId = node.id
    for (const el of canvas.querySelectorAll(".fr-node.selected"))
      el.classList.remove("selected")
    g.classList.add("selected")
    vscode.postMessage({ type: "nodeClicked", nodeId: node.id })
  })
  g.addEventListener("mouseenter", (e) =>
    showHover(node, model, e as MouseEvent),
  )
  g.addEventListener("mouseleave", () => {
    hoverEl.hidden = true
  })

  if (isNew) {
    g.style.opacity = "0"
    g.style.transition = "opacity 220ms ease"
    requestAnimationFrame(() => {
      g.style.opacity = "1"
    })
  }
  return g
}

/** Red badge for any error, amber for warnings-only, none otherwise. */
function buildBadge(
  node: GraphModelNode,
  nodeWidth: number,
): SVGGElement | null {
  if (node.diagnostics.length === 0) return null
  const hasError = node.diagnostics.some((d) => d.severity === "error")
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement
  g.setAttribute("class", "fr-badge")
  const circle = document.createElementNS(SVG_NS, "circle")
  circle.setAttribute("cx", String(nodeWidth - 11))
  circle.setAttribute("cy", "11")
  circle.setAttribute("r", "9")
  circle.setAttribute("fill", hasError ? "#F44336" : "#FFB300")
  g.appendChild(circle)
  const count = document.createElementNS(SVG_NS, "text")
  count.setAttribute("x", String(nodeWidth - 11))
  count.setAttribute("y", "15")
  count.setAttribute("text-anchor", "middle")
  count.textContent = String(node.diagnostics.length)
  g.appendChild(count)
  const title = document.createElementNS(SVG_NS, "title")
  title.textContent = node.diagnostics.map((d) => d.message).join("\n")
  g.appendChild(title)
  return g
}

// ── Hover card ──────────────────────────────────────────────────────

function showHover(
  node: GraphModelNode,
  model: GraphModelResponse,
  event: MouseEvent,
): void {
  clear(hoverEl)

  const title = el("div", "title", `${node.component} — ${node.label}`)
  hoverEl.appendChild(title)

  hoverEl.appendChild(
    el(
      "div",
      "muted",
      `${node.kind}${node.changelogMode ? ` · ${node.changelogMode}` : ""}`,
    ),
  )

  if (node.schema && node.schema.length > 0) {
    const table = document.createElement("table")
    for (const col of node.schema) {
      const row = document.createElement("tr")
      const name = document.createElement("td")
      name.textContent = col.name
      const type = document.createElement("td")
      type.className = "type"
      type.textContent = col.type
      row.appendChild(name)
      row.appendChild(type)
      table.appendChild(row)
    }
    hoverEl.appendChild(table)
  } else {
    hoverEl.appendChild(el("div", "muted", "Schema unavailable"))
  }

  const sql = node.statementIndices
    .map((i) => model.statements[i])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n\n")
  if (sql) {
    const pre = document.createElement("pre")
    pre.textContent = sql
    hoverEl.appendChild(pre)
  }

  // Position near the cursor, clamped to the viewport.
  const pad = 14
  const maxX = window.innerWidth - hoverEl.offsetWidth - pad
  const maxY = window.innerHeight - hoverEl.offsetHeight - pad
  hoverEl.style.left = `${Math.min(event.clientX + pad, Math.max(pad, maxX))}px`
  hoverEl.style.top = `${Math.min(event.clientY + pad, Math.max(pad, maxY))}px`
  hoverEl.hidden = false
}

// ── Helpers ─────────────────────────────────────────────────────────

function el(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

// Ask the host for the first model as soon as the script is live (covers the
// case where the panel opened before the host posted anything).
vscode.postMessage({ type: "requestRefresh" })
