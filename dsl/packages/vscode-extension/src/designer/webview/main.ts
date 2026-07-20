// The designer webview — a *dumb* canvas: JSON in (designer model + static
// palette/rules/prop-form-schema over postMessage), edit intents out. It
// imports no DSL and sends no LSP requests; the extension host brokers
// everything. Every model/schema string is inserted as text/SVG, never as
// HTML, honoring the page CSP.
//
// Two modes:
//   • LIVE — renders the synthesized pipeline (any file). Selecting a node
//     shows its prop form: `editable` props are inputs (enum dropdowns,
//     required markers, JSDoc help), `readOnly` props are read-only fields
//     with "Edit in source". Structural affordances (palette drop, node
//     re-parent drag, delete, add-join) follow the edit-safety matrix: live
//     only in a designer-managed file, disabled-with-reason otherwise.
//   • DRAFT — a blank scratch canvas for greenfield composition; palette
//     drops build a local static tree, and "Generate .tsx" hands it to the
//     host (the server prints + verifies; the host creates the file). The
//     draft never rewrites the open file.

import { kindColor } from "../../graph/palette.js"
import { computeLayout, type Layout } from "../../graph/webview/layout.js"
import type {
  CanvasNode,
  DesignerEdit,
  DesignerModelNode,
  DesignerModelResponse,
  DesignerPropEntry,
  DesignerStaticData,
  PropFormField,
} from "../protocol.js"

interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}
declare function acquireVsCodeApi(): VsCodeApi

const SVG_NS = "http://www.w3.org/2000/svg"
const vscode = acquireVsCodeApi()

const toolbarDraftBtn = document.getElementById(
  "btn-draft",
) as HTMLButtonElement
const toolbarGenerateBtn = document.getElementById(
  "btn-generate",
) as HTMLButtonElement
const toolbarDiscardBtn = document.getElementById(
  "btn-discard",
) as HTMLButtonElement
const fileKindEl = document.getElementById("filekind") as HTMLSpanElement
const statusEl = document.getElementById("status") as HTMLDivElement
const paletteEl = document.getElementById("palette") as HTMLDivElement
const emptyEl = document.getElementById("empty") as HTMLDivElement
const canvas = document.getElementById("canvas") as unknown as SVGSVGElement
const formEl = document.getElementById("form") as HTMLDivElement

// ── State ───────────────────────────────────────────────────────────

let staticData: DesignerStaticData | undefined
let model: DesignerModelResponse | undefined
/** Selected node ids (insertion-ordered; two enable Add Join). */
let selected: string[] = []
/** Greenfield draft tree, or `undefined` in live mode. */
let draft: DraftNode[] | undefined
let draftCounter = 0

interface DraftNode {
  readonly draftId: string
  readonly component: string
  props: Record<
    string,
    string | number | boolean | readonly (string | number)[]
  >
  identifierProps: Record<string, { identifier: string; importFrom: string }>
  children: DraftNode[]
}

// ── Message pump ────────────────────────────────────────────────────

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as {
    type: string
    data?: DesignerStaticData
    model?: DesignerModelResponse
    ok?: boolean
    refusedReason?: string
    error?: string
  }
  if (msg.type === "static" && msg.data) {
    staticData = msg.data
    renderPalette()
    return
  }
  if (msg.type === "model" && msg.model) {
    model = msg.model
    if (!draft) renderLive()
    return
  }
  if (msg.type === "editResult") {
    if (msg.ok) {
      hideStatus()
    } else {
      showStatus(
        msg.refusedReason ?? msg.error ?? "Edit failed.",
        !msg.refusedReason,
      )
    }
  }
})

// ── Status strip (every refusal carries its reason — task 8.2) ──────

function showStatus(message: string, isError = false): void {
  statusEl.textContent = message
  statusEl.classList.toggle("error", isError)
  statusEl.hidden = false
}

function hideStatus(): void {
  statusEl.hidden = true
}

// ── Edit-safety matrix, webview side (affordance gating) ────────────

function structuralAllowed(): { allowed: boolean; reason: string } {
  if (draft) return { allowed: true, reason: "" } // draft = local state only
  if (model?.fileKind === "designer-managed")
    return { allowed: true, reason: "" }
  return {
    allowed: false,
    reason:
      model?.fileKindReason ??
      "Structural editing requires a designer-managed file (`// @flink-reactor designer`).",
  }
}

function isValidChild(parent: string, child: string): boolean {
  const rules = staticData?.rules ?? {}
  const allowed = rules[parent]
  if (allowed === undefined) return true // unknown parent = allow all
  if (allowed === "*") return true
  return allowed.includes(child)
}

// ── Palette ─────────────────────────────────────────────────────────

function renderPalette(): void {
  clear(paletteEl)
  for (const group of staticData?.groups ?? []) {
    const heading = document.createElement("h3")
    heading.textContent = group.kind
    paletteEl.appendChild(heading)
    for (const component of group.components) {
      const item = document.createElement("div")
      item.className = "palette-item"
      item.textContent = component
      item.draggable = true
      item.style.borderLeft = `3px solid ${kindColor(kindOf(component))}`
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("application/x-fr-component", component)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy"
      })
      item.title = `Drag onto the canvas to add a ${component}`
      paletteEl.appendChild(item)
    }
  }
}

function kindOf(component: string): string {
  for (const group of staticData?.groups ?? []) {
    if (group.components.includes(component)) {
      // Group headings are plural display names; map back to palette kinds.
      const mapping: Record<string, string> = {
        Sources: "Source",
        Sinks: "Sink",
        Transforms: "Transform",
        Joins: "Join",
        Windows: "Window",
        Catalogs: "Catalog",
        "Escape hatches": "RawSQL",
        Containers: "Pipeline",
      }
      return mapping[group.kind] ?? "Transform"
    }
  }
  return "Transform"
}

// ── Live rendering ──────────────────────────────────────────────────

function renderLive(): void {
  toolbarGenerateBtn.hidden = true
  toolbarDiscardBtn.hidden = true
  toolbarDraftBtn.hidden = false
  if (!model) return
  if (!model.ok) {
    showStatus(model.error ?? "Synthesis failed.", true)
    canvas.classList.add("dimmed")
    vscode.postMessage({
      type: "rendered",
      ok: false,
      version: model.version,
      nodeCount: 0,
    })
    return
  }
  hideStatus()
  canvas.classList.remove("dimmed")
  fileKindEl.textContent =
    model.fileKind === "designer-managed"
      ? "designer-managed — structural editing on"
      : `read-only structure — ${model.fileKind === "pragma-violated" ? "pragma violated" : "arbitrary file"}`
  fileKindEl.title = model.fileKindReason ?? ""

  renderGraph(
    model.nodes,
    model.edges.map((e) => ({ from: e.from, to: e.to })),
  )
  selected = selected.filter((id) => model?.nodes.some((n) => n.id === id))
  renderForm()
  vscode.postMessage({
    type: "rendered",
    ok: true,
    version: model.version,
    nodeCount: model.nodes.length,
  })
}

interface RenderableNode {
  readonly id: string
  readonly kind: string
  readonly component: string
  readonly label: string
  readonly layer?: number
  readonly diagnostics?: readonly { readonly message: string }[]
}

function renderGraph(
  nodes: readonly RenderableNode[],
  edges: readonly { from: string; to: string }[],
): void {
  const hasNodes = nodes.length > 0
  emptyEl.hidden = hasNodes
  if (!hasNodes && draft) {
    emptyEl.textContent =
      "Blank canvas — drag components from the palette to compose a new pipeline."
  }
  clear(canvas)
  if (!hasNodes) return

  // Reuse the Tier-2 layered layout + kind palette (task 7.4).
  const layout = computeLayout(
    nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      component: n.component,
      label: n.label,
      statementIndices: [],
      diagnostics: [],
      ...(n.layer !== undefined ? { layer: n.layer } : {}),
    })),
    edges,
  )
  canvas.setAttribute("width", String(layout.width))
  canvas.setAttribute("height", String(layout.height))
  canvas.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`)

  for (const edge of edges) {
    const path = buildEdge(edge, layout)
    if (path) canvas.appendChild(path)
  }
  for (const node of nodes) {
    const placed = layout.nodes.get(node.id)
    if (!placed) continue
    canvas.appendChild(buildNode(node, placed))
  }
}

function buildEdge(
  edge: { from: string; to: string },
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
  path.setAttribute("class", "fr-edge")
  return path
}

function buildNode(
  node: RenderableNode,
  placed: { x: number; y: number; w: number; h: number },
): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement
  g.setAttribute(
    "class",
    selected.includes(node.id) ? "fr-node selected" : "fr-node",
  )
  g.setAttribute("transform", `translate(${placed.x}, ${placed.y})`)
  g.dataset.nodeId = node.id

  const rect = document.createElementNS(SVG_NS, "rect")
  rect.setAttribute("width", String(placed.w))
  rect.setAttribute("height", String(placed.h))
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

  const title = document.createElementNS(SVG_NS, "title")
  title.textContent = `${node.component} — ${node.label}\nClick to edit props; double-click to open in source.`
  g.appendChild(title)

  g.addEventListener("click", (e) => {
    const multi = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey
    if (multi) {
      selected = selected.includes(node.id)
        ? selected.filter((id) => id !== node.id)
        : [...selected, node.id].slice(-2)
    } else {
      selected = [node.id]
    }
    refreshSelection()
    renderForm()
  })
  g.addEventListener("dblclick", () => {
    if (!draft) vscode.postMessage({ type: "revealNode", nodeId: node.id })
  })

  // Re-parent drag (live, designer-managed) / draft reorder.
  g.addEventListener("dragover", (e) => {
    e.preventDefault()
    const valid = dropValidity(e as DragEvent, node)
    g.classList.toggle("droptarget", valid === "valid")
    g.classList.toggle("dropinvalid", valid === "invalid")
  })
  g.addEventListener("dragleave", () => {
    g.classList.remove("droptarget", "dropinvalid")
  })
  g.addEventListener("drop", (e) => {
    e.preventDefault()
    e.stopPropagation()
    g.classList.remove("droptarget", "dropinvalid")
    onDrop(e as DragEvent, node)
  })
  // Node drag start (re-parent source).
  ;(g as unknown as HTMLElement).draggable = true
  g.addEventListener("dragstart", (e) => {
    const de = e as DragEvent
    de.dataTransfer?.setData("application/x-fr-node", node.id)
    if (de.dataTransfer) de.dataTransfer.effectAllowed = "move"
  })

  return g
}

function refreshSelection(): void {
  for (const el of Array.from(canvas.querySelectorAll(".fr-node"))) {
    const g = el as SVGGElement
    g.classList.toggle(
      "selected",
      g.dataset.nodeId !== undefined && selected.includes(g.dataset.nodeId),
    )
  }
}

// ── Drag & drop (palette add + node re-parent) ──────────────────────

type DropKind = "valid" | "invalid" | "none"

function dropValidity(e: DragEvent, _target: RenderableNode): DropKind {
  const component = e.dataTransfer?.types.includes("application/x-fr-component")
  const nodeMove = e.dataTransfer?.types.includes("application/x-fr-node")
  if (!component && !nodeMove) return "none"
  // The DataTransfer payload is unreadable during dragover; validity of the
  // specific component is re-checked on drop. Here we gate by the matrix.
  if (!structuralAllowed().allowed) return "invalid"
  return "valid"
}

function onDrop(e: DragEvent, target: RenderableNode | null): void {
  const component = e.dataTransfer?.getData("application/x-fr-component")
  const movedNodeId = e.dataTransfer?.getData("application/x-fr-node")

  const gate = structuralAllowed()
  if (!gate.allowed) {
    showStatus(gate.reason)
    return
  }

  if (component) {
    const parentComponent = target?.component ?? "Pipeline"
    if (!isValidChild(parentComponent, component)) {
      showStatus(
        `\`${component}\` is not a valid child of \`${parentComponent}\` — drop rejected by the hierarchy rules.`,
      )
      return
    }
    if (draft) {
      addDraftNode(component, target?.id)
      return
    }
    sendEdit({
      kind: "structural",
      edit: {
        op: "addNode",
        component,
        props: defaultPropsFor(component),
        parentId: target?.id ?? null,
      },
    })
    return
  }

  if (movedNodeId && target && movedNodeId !== target.id) {
    if (draft) return // draft reorder not supported in v1
    const moved = model?.nodes.find((n) => n.id === movedNodeId)
    if (moved && !isValidChild(target.component, moved.component)) {
      showStatus(
        `\`${moved.component}\` is not a valid child of \`${target.component}\` — re-parent rejected by the hierarchy rules.`,
      )
      return
    }
    sendEdit({
      kind: "structural",
      edit: { op: "reparentNode", nodeId: movedNodeId, parentId: target.id },
    })
  }
}

// Background drop = add under the Pipeline root.
canvas.addEventListener("dragover", (e) => e.preventDefault())
canvas.addEventListener("drop", (e) => {
  e.preventDefault()
  onDrop(e as DragEvent, null)
})

/** Required literal props seeded so a fresh element synthesizes where
 *  possible (the prop form is the real editing surface). */
function defaultPropsFor(
  component: string,
): Record<string, string | number | boolean> {
  const schema = staticData?.schema[component]
  const props: Record<string, string | number | boolean> = {}
  for (const field of schema?.fields ?? []) {
    if (!field.required || field.readOnlyInForm) continue
    if (field.inputKind === "string") props[field.name] = field.name
    else if (field.inputKind === "enum")
      props[field.name] = field.options?.[0] ?? ""
    else if (field.inputKind === "number") props[field.name] = 1
    else if (field.inputKind === "boolean") props[field.name] = true
  }
  return props
}

function sendEdit(edit: DesignerEdit): void {
  hideStatus()
  vscode.postMessage({ type: "applyEdit", edit })
}

// ── Prop form ───────────────────────────────────────────────────────

function renderForm(): void {
  clear(formEl)
  if (draft) {
    renderDraftForm()
    return
  }
  const node = model?.nodes.find((n) => n.id === selected[0])
  if (!node) {
    formEl.appendChild(el("div", "muted", "Select a node to edit its props."))
    renderJoinPanel()
    renderLegend()
    return
  }
  formEl.appendChild(el("h2", "", `${node.component}`))
  formEl.appendChild(el("div", "muted", node.label))

  const schema = staticData?.schema[node.component]
  const entries = new Map(node.props.map((p) => [p.name, p]))
  const rendered = new Set<string>()
  for (const field of schema?.fields ?? []) {
    formEl.appendChild(buildField(node, field, entries.get(field.name)))
    rendered.add(field.name)
  }
  // Props present in source but unknown to the schema still render (readOnly).
  for (const entry of node.props) {
    if (rendered.has(entry.name)) continue
    formEl.appendChild(buildField(node, undefined, entry))
  }

  const actions = document.createElement("div")
  actions.className = "actions"
  const openSource = document.createElement("button")
  openSource.textContent = "Open in source"
  openSource.addEventListener("click", () =>
    vscode.postMessage({ type: "revealNode", nodeId: node.id }),
  )
  actions.appendChild(openSource)

  const gate = structuralAllowed()
  const del = document.createElement("button")
  del.textContent = "Delete node"
  del.disabled = !gate.allowed
  if (!gate.allowed) del.title = gate.reason
  del.addEventListener("click", () =>
    sendEdit({
      kind: "structural",
      edit: { op: "deleteNode", nodeId: node.id },
    }),
  )
  actions.appendChild(del)
  if (!gate.allowed) actions.appendChild(el("div", "reason", gate.reason))
  formEl.appendChild(actions)

  renderJoinPanel()
  renderLegend()
}

function buildField(
  node: DesignerModelNode,
  field: PropFormField | undefined,
  entry: DesignerPropEntry | undefined,
): HTMLDivElement {
  const wrap = document.createElement("div")
  wrap.className = "field"
  const name = field?.name ?? entry?.name ?? ""

  const label = document.createElement("label")
  label.textContent = name
  if (field?.required) {
    const req = document.createElement("span")
    req.className = "req"
    req.textContent = " *"
    req.title = "Required"
    label.appendChild(req)
  }
  wrap.appendChild(label)

  const editableHere =
    entry?.classification === "editable" &&
    field !== undefined &&
    !field.readOnlyInForm &&
    (field.inputKind === "string" ||
      field.inputKind === "enum" ||
      field.inputKind === "number" ||
      field.inputKind === "boolean" ||
      field.inputKind === "array")

  if (editableHere && field && entry) {
    wrap.appendChild(buildInput(node, field, entry))
  } else {
    // Read-only: a computed/identifier/spread value, a non-literal type, or a
    // prop not set in source. Always offers "Edit in source" (task 7.6).
    const row = document.createElement("div")
    row.className = "readonly-row"
    const input = document.createElement("input")
    input.type = "text"
    input.readOnly = true
    input.value =
      entry === undefined
        ? "(not set)"
        : entry.classification === "readOnly"
          ? "(expression — edit in source)"
          : printableValue(entry.value)
    row.appendChild(input)
    const btn = document.createElement("button")
    btn.textContent = "Edit in source"
    btn.title =
      entry?.classification === "readOnly"
        ? "This value is a computed expression, variable reference, or spread — the designer never rewrites those."
        : "Set this prop in the .tsx."
    btn.addEventListener("click", () =>
      vscode.postMessage({ type: "revealNode", nodeId: node.id }),
    )
    row.appendChild(btn)
    wrap.appendChild(row)
  }

  if (field?.help) wrap.appendChild(el("div", "help", field.help))
  return wrap
}

function buildInput(
  node: DesignerModelNode,
  field: PropFormField,
  entry: DesignerPropEntry,
): HTMLElement {
  const commit = (value: string | number | boolean | (string | number)[]) =>
    sendEdit({
      kind: "scalarProp",
      nodeId: node.id,
      prop: field.name,
      value,
    })

  if (field.inputKind === "enum") {
    const select = document.createElement("select")
    for (const option of field.options ?? []) {
      const opt = document.createElement("option")
      opt.value = option
      opt.textContent = option
      if (entry.value === option) opt.selected = true
      select.appendChild(opt)
    }
    select.addEventListener("change", () => commit(select.value))
    return select
  }
  if (field.inputKind === "boolean") {
    const select = document.createElement("select")
    for (const option of ["true", "false"]) {
      const opt = document.createElement("option")
      opt.value = option
      opt.textContent = option
      if (String(entry.value) === option) opt.selected = true
      select.appendChild(opt)
    }
    select.addEventListener("change", () => commit(select.value === "true"))
    return select
  }
  const input = document.createElement("input")
  input.type = field.inputKind === "number" ? "number" : "text"
  input.value = printableValue(entry.value)
  input.addEventListener("change", () => {
    if (field.inputKind === "number") {
      const num = Number(input.value)
      if (Number.isFinite(num)) commit(num)
      return
    }
    if (field.inputKind === "array") {
      commit(
        input.value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      )
      return
    }
    commit(input.value)
  })
  return input
}

function printableValue(value: DesignerPropEntry["value"]): string {
  if (value === undefined) return ""
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/** Add-join affordance: appears when exactly two nodes are selected. */
function renderJoinPanel(): void {
  if (draft || selected.length !== 2) return
  const gate = structuralAllowed()
  const [leftId, rightId] = selected
  const wrap = document.createElement("div")
  wrap.className = "field"
  wrap.appendChild(el("h2", "", "Add Join"))
  wrap.appendChild(el("div", "muted", `${leftId} ⋈ ${rightId}`))
  const on = document.createElement("input")
  on.type = "text"
  on.placeholder = "join condition, e.g. a.id = b.id"
  wrap.appendChild(on)
  const btn = document.createElement("button")
  btn.textContent = "Add Join"
  btn.disabled = !gate.allowed
  if (!gate.allowed) btn.title = gate.reason
  btn.addEventListener("click", () => {
    if (!on.value.trim() || !leftId || !rightId) return
    sendEdit({
      kind: "structural",
      edit: { op: "addJoin", leftId, rightId, on: on.value.trim() },
    })
  })
  wrap.appendChild(btn)
  if (!gate.allowed) wrap.appendChild(el("div", "reason", gate.reason))
  formEl.appendChild(wrap)
}

/** The honest-scope legend (task 9.3): the editable/read-only boundary and
 *  the edit-safety matrix, always visible in the form panel. */
function renderLegend(): void {
  const legend = document.createElement("div")
  legend.className = "legend"
  legend.appendChild(el("h3", "", "What the designer can edit"))
  legend.appendChild(
    el(
      "p",
      "",
      "Literal props (strings, numbers, booleans, literal arrays) are editable on ANY pipeline — each edit rewrites only that initializer.",
    ),
  )
  legend.appendChild(
    el(
      "p",
      "",
      "Computed props, variable references, spreads, templates, and functions are read-only — use “Edit in source”. The designer never rewrites them.",
    ),
  )
  legend.appendChild(
    el(
      "p",
      "",
      "Structural edits (add / delete / re-parent / join) need a designer-managed file: `// @flink-reactor designer` on a fully static pipeline.",
    ),
  )
  legend.appendChild(
    el(
      "p",
      "",
      "Arbitrary pipelines are never regenerated from the canvas — the .tsx stays the source of truth.",
    ),
  )
  formEl.appendChild(legend)
}

// ── Draft (greenfield) mode ─────────────────────────────────────────

toolbarDraftBtn.addEventListener("click", () => {
  draft = []
  draftCounter = 0
  selected = []
  toolbarGenerateBtn.hidden = false
  toolbarGenerateBtn.disabled = true
  toolbarDiscardBtn.hidden = false
  toolbarDraftBtn.hidden = true
  fileKindEl.textContent = "draft — composing a new pipeline"
  fileKindEl.title = ""
  hideStatus()
  renderDraft()
})

toolbarDiscardBtn.addEventListener("click", () => {
  draft = undefined
  selected = []
  toolbarDraftBtn.hidden = false
  toolbarGenerateBtn.hidden = true
  toolbarDiscardBtn.hidden = true
  renderLive()
})

toolbarGenerateBtn.addEventListener("click", () => {
  if (!draft || draft.length === 0) return
  vscode.postMessage({ type: "generateDraft", nodes: draft.map(toCanvasNode) })
})

function toCanvasNode(node: DraftNode): CanvasNode {
  return {
    component: node.component,
    props: node.props,
    ...(Object.keys(node.identifierProps).length > 0
      ? { identifierProps: node.identifierProps }
      : {}),
    ...(node.children.length > 0
      ? { children: node.children.map(toCanvasNode) }
      : {}),
  }
}

function addDraftNode(component: string, parentDraftId?: string): void {
  if (!draft) return
  const node: DraftNode = {
    draftId: `draft_${draftCounter++}`,
    component,
    props: defaultPropsFor(component),
    identifierProps: {},
    children: [],
  }
  if (parentDraftId) {
    const parent = findDraft(draft, parentDraftId)
    if (parent) parent.children.push(node)
    else draft.push(node)
  } else {
    draft.push(node)
  }
  toolbarGenerateBtn.disabled = draft.length === 0
  selected = [node.draftId]
  renderDraft()
}

function findDraft(nodes: DraftNode[], draftId: string): DraftNode | undefined {
  for (const n of nodes) {
    if (n.draftId === draftId) return n
    const inner = findDraft(n.children, draftId)
    if (inner) return inner
  }
  return undefined
}

function renderDraft(): void {
  if (!draft) return
  const flat: RenderableNode[] = []
  const edges: { from: string; to: string }[] = []
  flattenDraft(draft, flat, edges)
  renderGraph(flat, edges)
  emptyEl.hidden = flat.length > 0
  if (flat.length === 0) {
    emptyEl.textContent =
      "Blank canvas — drag components from the palette to compose a new pipeline."
    emptyEl.hidden = false
  }
  renderForm()
}

/** Sibling order is dataflow order (the DSL's chain rule), so consecutive
 *  siblings get edges; a parent links to its first child. */
function flattenDraft(
  nodes: DraftNode[],
  out: RenderableNode[],
  edges: { from: string; to: string }[],
): void {
  let prev: DraftNode | undefined
  for (const n of nodes) {
    out.push({
      id: n.draftId,
      kind: kindOf(n.component),
      component: n.component,
      label: String(n.props.name ?? n.props.topic ?? n.component),
    })
    if (prev) edges.push({ from: prev.draftId, to: n.draftId })
    if (n.children.length > 0) {
      edges.push({ from: n.draftId, to: n.children[0]?.draftId ?? "" })
      flattenDraft(n.children, out, edges)
    }
    prev = n
  }
}

function renderDraftForm(): void {
  clear(formEl)
  if (!draft) return
  const node = selected[0] ? findDraft(draft, selected[0]) : undefined
  if (!node) {
    formEl.appendChild(
      el(
        "div",
        "muted",
        "Drag components from the palette; select a node to set its props. “Generate .tsx” writes a new static pipeline file.",
      ),
    )
    renderLegend()
    return
  }
  formEl.appendChild(el("h2", "", node.component))
  const schema = staticData?.schema[node.component]
  for (const field of schema?.fields ?? []) {
    formEl.appendChild(buildDraftField(node, field))
  }
  const actions = document.createElement("div")
  actions.className = "actions"
  const del = document.createElement("button")
  del.textContent = "Remove from draft"
  del.addEventListener("click", () => {
    if (!draft || !node) return
    removeDraft(draft, node.draftId)
    selected = []
    toolbarGenerateBtn.disabled = draft.length === 0
    renderDraft()
  })
  actions.appendChild(del)
  formEl.appendChild(actions)
  renderLegend()
}

function removeDraft(nodes: DraftNode[], draftId: string): boolean {
  const index = nodes.findIndex((n) => n.draftId === draftId)
  if (index >= 0) {
    nodes.splice(index, 1)
    return true
  }
  return nodes.some((n) => removeDraft(n.children, draftId))
}

function buildDraftField(node: DraftNode, field: PropFormField): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "field"
  const label = document.createElement("label")
  label.textContent = field.name
  if (field.required) {
    const req = document.createElement("span")
    req.className = "req"
    req.textContent = " *"
    label.appendChild(req)
  }
  wrap.appendChild(label)

  if (field.readOnlyInForm) {
    // Object-typed props (e.g. `schema`) reference an existing module export
    // by identifier — the one non-literal form a static file can carry.
    const ident = document.createElement("input")
    ident.type = "text"
    ident.placeholder = "identifier, e.g. OrdersSchema"
    const from = document.createElement("input")
    from.type = "text"
    from.placeholder = "import from, e.g. @/schemas/orders"
    from.style.marginTop = "2px"
    const existing = node.identifierProps[field.name]
    if (existing) {
      ident.value = existing.identifier
      from.value = existing.importFrom
    }
    const commit = () => {
      if (ident.value.trim() && from.value.trim()) {
        node.identifierProps[field.name] = {
          identifier: ident.value.trim(),
          importFrom: from.value.trim(),
        }
      } else {
        delete node.identifierProps[field.name]
      }
    }
    ident.addEventListener("change", commit)
    from.addEventListener("change", commit)
    wrap.appendChild(ident)
    wrap.appendChild(from)
  } else if (field.inputKind === "enum") {
    const select = document.createElement("select")
    const blank = document.createElement("option")
    blank.value = ""
    blank.textContent = "(unset)"
    select.appendChild(blank)
    for (const option of field.options ?? []) {
      const opt = document.createElement("option")
      opt.value = option
      opt.textContent = option
      if (node.props[field.name] === option) opt.selected = true
      select.appendChild(opt)
    }
    select.addEventListener("change", () => {
      if (select.value) node.props[field.name] = select.value
      else delete node.props[field.name]
      renderDraft()
    })
    wrap.appendChild(select)
  } else {
    const input = document.createElement("input")
    input.type = field.inputKind === "number" ? "number" : "text"
    const current = node.props[field.name]
    input.value = current === undefined ? "" : printableValue(current)
    input.addEventListener("change", () => {
      if (input.value === "") {
        delete node.props[field.name]
      } else if (field.inputKind === "number") {
        const num = Number(input.value)
        if (Number.isFinite(num)) node.props[field.name] = num
      } else if (field.inputKind === "boolean") {
        node.props[field.name] = input.value === "true"
      } else if (field.inputKind === "array") {
        node.props[field.name] = input.value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      } else {
        node.props[field.name] = input.value
      }
      renderDraft()
    })
    wrap.appendChild(input)
  }
  if (field.help) wrap.appendChild(el("div", "help", field.help))
  return wrap
}

// ── Helpers ─────────────────────────────────────────────────────────

function el(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.textContent = text
  return node
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

// Ask the host for the first model as soon as the script is live.
vscode.postMessage({ type: "requestRefresh" })
