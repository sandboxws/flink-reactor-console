// Structural codemods (visual-designer, tasks 4.2–4.3): add-node,
// delete-node, re-parent, and add-join over a designer-managed (pragma-
// verified, fully static) `.tsx`.
//
// Strategy: `ts-morph` is the span oracle — every element/insertion span is
// resolved on the ORIGINAL text via the AST (elements located by node id
// through the same `buildPositionMap` prediction the rest of the server
// uses) — and the mutation is deterministic text surgery over those spans,
// applied in descending offset order so no splice invalidates another. No
// intermediate AST states, no formatter pass: surrounding code, comments,
// and formatting outside the touched spans are byte-identical by
// construction. The verify-then-commit gate (re-parse + re-synthesize) in
// `apply-edit.ts` is the backstop for anything surgery got wrong.
//
// Hierarchy rules (task 4.3): an add/re-parent placement is validated against
// the same `@flink-reactor/ts-plugin` parent→children rules a palette drop
// uses, so a codemod refuses exactly what the canvas would refuse.

import { createRulesRegistry } from "@flink-reactor/ts-plugin/rules"
import type { JsxElement, JsxSelfClosingElement, SourceFile } from "ts-morph"
import { Project, SyntaxKind, ts } from "ts-morph"
import { buildPositionMap } from "../mappers/source-position-mapper.js"
import type { NodeProjection } from "../synth/types.js"
import type { StructuralOp } from "./model.js"

export type StructuralCodemodResult =
  | { readonly ok: true; readonly newText: string }
  | { readonly ok: false; readonly refusedReason: string }

const rules = createRulesRegistry()

type AnyJsxElement = JsxElement | JsxSelfClosingElement

interface Splice {
  readonly start: number
  readonly end: number
  readonly text: string
}

export function applyStructuralCodemod(
  sourceText: string,
  fileName: string,
  nodes: readonly NodeProjection[],
  op: StructuralOp,
): StructuralCodemodResult {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  })
  const sf = project.createSourceFile(
    fileName.endsWith(".tsx") ? fileName : "pipeline.tsx",
    sourceText,
    { scriptKind: ts.ScriptKind.TSX },
  )
  const locate = makeLocator(sf, sourceText, fileName, nodes)

  switch (op.op) {
    case "addNode":
      return addNode(sourceText, locate, nodes, op)
    case "deleteNode":
      return deleteNode(sourceText, locate, op.nodeId)
    case "reparentNode":
      return reparentNode(sourceText, locate, nodes, op)
    case "addJoin":
      return addJoin(sourceText, sf, locate, nodes, op)
  }
}

// ── Ops ─────────────────────────────────────────────────────────────

function addNode(
  sourceText: string,
  locate: Locator,
  nodes: readonly NodeProjection[],
  op: Extract<StructuralOp, { op: "addNode" }>,
): StructuralCodemodResult {
  const parent = resolveParent(locate, nodes, op.parentId)
  if (!parent.ok) return parent
  const parentComponent = componentName(parent.element)
  if (!rules.isValidChild(parentComponent, op.component)) {
    return {
      ok: false,
      refusedReason: `\`${op.component}\` is not a valid child of \`${parentComponent}\` — the hierarchy rules refuse this placement (same as a palette drop).`,
    }
  }
  const elementText = printElement(op.component, op.props)
  const splices = [
    insertChildSplice(sourceText, parent.element, elementText, op.index),
    ...ensureImportedSplices(locate.sourceFile, [op.component]),
  ]
  return { ok: true, newText: applySplices(sourceText, splices) }
}

function deleteNode(
  sourceText: string,
  locate: Locator,
  nodeId: string,
): StructuralCodemodResult {
  const element = locate(nodeId)
  if (!element) return notLocated(nodeId)
  return {
    ok: true,
    newText: applySplices(sourceText, [removalSplice(sourceText, element)]),
  }
}

function reparentNode(
  sourceText: string,
  locate: Locator,
  nodes: readonly NodeProjection[],
  op: Extract<StructuralOp, { op: "reparentNode" }>,
): StructuralCodemodResult {
  const element = locate(op.nodeId)
  if (!element) return notLocated(op.nodeId)
  const parent = resolveParent(locate, nodes, op.parentId)
  if (!parent.ok) return parent
  const parentComponent = componentName(parent.element)
  const childComponent = componentName(element)
  if (!rules.isValidChild(parentComponent, childComponent)) {
    return {
      ok: false,
      refusedReason: `\`${childComponent}\` is not a valid child of \`${parentComponent}\` — the hierarchy rules refuse this placement (same as a palette drop).`,
    }
  }
  const elStart = element.getStart()
  const elEnd = element.getEnd()
  const parentStart = parent.element.getStart()
  const parentEnd = parent.element.getEnd()
  // A node cannot move into its own subtree, and moving into a parent whose
  // span overlaps the element's would corrupt both splices.
  if (parentStart >= elStart && parentEnd <= elEnd) {
    return {
      ok: false,
      refusedReason: "Cannot re-parent a node into its own subtree.",
    }
  }
  const moved = element.getText()
  const removal = removalSplice(sourceText, element)
  const insertion = insertChildSplice(
    sourceText,
    parent.element,
    moved,
    op.index,
  )
  if (insertion.start >= removal.start && insertion.start <= removal.end) {
    return {
      ok: false,
      refusedReason:
        "Re-parent target position overlaps the node being moved — refused.",
    }
  }
  return { ok: true, newText: applySplices(sourceText, [removal, insertion]) }
}

function addJoin(
  sourceText: string,
  sf: SourceFile,
  locate: Locator,
  nodes: readonly NodeProjection[],
  op: Extract<StructuralOp, { op: "addJoin" }>,
): StructuralCodemodResult {
  if (op.leftId === op.rightId) {
    return {
      ok: false,
      refusedReason: "A join needs two distinct upstream nodes.",
    }
  }
  if (!rules.isValidChild("Pipeline", "Join")) {
    return {
      ok: false,
      refusedReason:
        "`Join` is not a valid child of `Pipeline` per the hierarchy rules.",
    }
  }
  const left = locate(op.leftId)
  if (!left) return notLocated(op.leftId)
  const right = locate(op.rightId)
  if (!right) return notLocated(op.rightId)
  if (overlaps(left, right)) {
    return {
      ok: false,
      refusedReason:
        "Join inputs must be disjoint elements — one input is nested inside the other.",
    }
  }

  const splices: Splice[] = []
  const sides: { id: string; varName: string }[] = []
  // Hoist each input that is not already a module-level `const X = (<…/>)`
  // into one, so the Join can reference it by identifier (identifier props
  // are inside the static-subset contract).
  const exportPos = exportDefaultStart(sf)
  const hoistedElements: AnyJsxElement[] = []
  let hoisted = ""
  for (const [id, element] of [
    [op.leftId, left],
    [op.rightId, right],
  ] as const) {
    const existing = constNameFor(element)
    if (existing) {
      sides.push({ id, varName: existing })
      continue
    }
    const varName = toVarName(id)
    hoisted += `const ${varName} = (\n  ${reindent(element.getText(), "  ")}\n)\n\n`
    sides.push({ id, varName })
    hoistedElements.push(element)
  }
  if (hoisted.length > 0) {
    splices.push({ start: exportPos, end: exportPos, text: hoisted })
  }

  const leftVar = sides.find((s) => s.id === op.leftId)
  const rightVar = sides.find((s) => s.id === op.rightId)
  if (!leftVar || !rightVar) {
    return { ok: false, refusedReason: "Join inputs could not be resolved." }
  }
  const joinText = `<Join left={${leftVar.varName}} right={${rightVar.varName}} on=${JSON.stringify(op.on)}${op.joinType ? ` type=${JSON.stringify(op.joinType)}` : ""} />`
  splices.push(...ensureImportedSplices(sf, ["Join"]))

  // The Join takes the CHAIN POSITION of the first hoisted input (sibling
  // order is dataflow order — appending at the end would re-wire any
  // downstream sink onto the wrong upstream). When both inputs were already
  // module-level consts, append under the pipeline instead.
  hoistedElements.sort((a, b) => a.getStart() - b.getStart())
  const first = hoistedElements[0]
  if (first) {
    const removal = removalSplice(sourceText, first)
    const indent = lineIndent(sourceText, first.getStart())
    // When the removal expanded to whole-line bounds the replacement re-emits
    // the line (indent + join + newline); otherwise it replaces the bare span.
    const standsAlone = removal.start < first.getStart()
    splices.push({
      start: removal.start,
      end: removal.end,
      text: standsAlone ? `${indent}${joinText}\n` : joinText,
    })
    for (const el of hoistedElements.slice(1)) {
      splices.push(removalSplice(sourceText, el))
    }
  } else {
    const pipeline = resolveParent(locate, nodes, null)
    if (!pipeline.ok) return pipeline
    splices.push(insertChildSplice(sourceText, pipeline.element, joinText))
  }

  return { ok: true, newText: applySplices(sourceText, splices) }
}

// ── Element location ────────────────────────────────────────────────

type Locator = ((nodeId: string) => AnyJsxElement | undefined) & {
  readonly sourceFile: SourceFile
}

/** nodeId → its ts-morph JSX element, via the shared position-map prediction
 *  (exact on a verified static-subset file). */
function makeLocator(
  sf: SourceFile,
  sourceText: string,
  fileName: string,
  nodes: readonly NodeProjection[],
): Locator {
  const positionMap = buildPositionMap(sourceText, fileName, nodes)
  const locate = (nodeId: string): AnyJsxElement | undefined => {
    const range = positionMap.map.get(nodeId)
    if (!range) return undefined
    const pos = sf.compilerNode.getPositionOfLineAndCharacter(
      range.start.line,
      range.start.character,
    )
    const at = sf.getDescendantAtPos(pos)
    const selfClosing = at?.getFirstAncestorByKind(
      SyntaxKind.JsxSelfClosingElement,
    )
    if (selfClosing) return selfClosing
    // The mapped range points at the OPENING element — its parent is the
    // JsxElement that spans the children too.
    const opening = at?.getFirstAncestorByKind(SyntaxKind.JsxOpeningElement)
    return opening?.getFirstAncestorByKind(SyntaxKind.JsxElement)
  }
  return Object.assign(locate, { sourceFile: sf })
}

/** Splices ensuring each (root) component is named in the `@flink-reactor/dsl`
 *  import — a structural codemod that introduces a component the file does not
 *  import yet would otherwise fail verification ("X is not defined"). */
function ensureImportedSplices(
  sf: SourceFile,
  components: readonly string[],
): Splice[] {
  const decl = sf
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "@flink-reactor/dsl")
  if (!decl) return [] // unexpected for a pipeline; verification will catch it
  const named = decl.getNamedImports()
  const have = new Set(named.map((n) => n.getName()))
  const missing = [
    ...new Set(
      components.map((c) => c.split(".")[0] ?? c).filter((c) => !have.has(c)),
    ),
  ]
  const last = named[named.length - 1]
  if (missing.length === 0 || !last) return []
  const multiLine = decl.getText().includes("\n")
  const text = missing.map((c) => (multiLine ? `,\n  ${c}` : `, ${c}`)).join("")
  return [{ start: last.getEnd(), end: last.getEnd(), text }]
}

function resolveParent(
  locate: Locator,
  nodes: readonly NodeProjection[],
  parentId: string | null,
):
  | { readonly ok: true; readonly element: AnyJsxElement }
  | { readonly ok: false; readonly refusedReason: string } {
  const id =
    parentId ?? nodes.find((n) => n.component === "Pipeline")?.id ?? null
  if (id === null) {
    return {
      ok: false,
      refusedReason: "No `<Pipeline>` container found to insert under.",
    }
  }
  const element = locate(id)
  if (!element) {
    return {
      ok: false,
      refusedReason: `Parent node "${id}" could not be located in the source.`,
    }
  }
  return { ok: true, element }
}

function notLocated(nodeId: string): StructuralCodemodResult {
  return {
    ok: false,
    refusedReason: `Node "${nodeId}" could not be located in the source.`,
  }
}

// ── Span surgery ────────────────────────────────────────────────────

/** Apply non-overlapping splices in descending start order. */
function applySplices(text: string, splices: readonly Splice[]): string {
  const ordered = [...splices].sort((a, b) => b.start - a.start)
  let result = text
  for (const s of ordered) {
    result = result.slice(0, s.start) + s.text + result.slice(s.end)
  }
  return result
}

/** Remove an element including its own line when it stands alone on it. */
function removalSplice(sourceText: string, element: AnyJsxElement): Splice {
  let start = element.getStart()
  let end = element.getEnd()
  const lineStart = sourceText.lastIndexOf("\n", start - 1) + 1
  if (sourceText.slice(lineStart, start).trim() === "") {
    const after = sourceText.indexOf("\n", end)
    if (after !== -1 && sourceText.slice(end, after).trim() === "") {
      start = lineStart
      end = after + 1
    }
  }
  return { start, end, text: "" }
}

/**
 * Splice inserting `elementText` as a child of `parent` at `index` (clamped;
 * appended when omitted), converting a self-closing parent to an open/close
 * pair when needed. Indentation follows the surrounding lines.
 */
function insertChildSplice(
  sourceText: string,
  parent: AnyJsxElement,
  elementText: string,
  index?: number,
): Splice {
  const parentIndent = lineIndent(sourceText, parent.getStart())
  const childIndent = `${parentIndent}  `

  if (parent.getKind() === SyntaxKind.JsxSelfClosingElement) {
    // `<X … />` → `<X …>\n<child/>\n</X>` — rebuilt in place.
    const text = parent.getText()
    const tag = componentName(parent)
    const rebuilt = `${text.replace(/\s*\/>$/, ">")}\n${childIndent}${reindent(elementText, childIndent)}\n${parentIndent}</${tag}>`
    return { start: parent.getStart(), end: parent.getEnd(), text: rebuilt }
  }

  const jsx = parent as JsxElement
  const children = jsx
    .getJsxChildren()
    .filter(
      (c) =>
        c.getKind() === SyntaxKind.JsxElement ||
        c.getKind() === SyntaxKind.JsxSelfClosingElement,
    )
  const clamped =
    index === undefined
      ? children.length
      : Math.max(0, Math.min(index, children.length))
  const block = `${childIndent}${reindent(elementText, childIndent)}\n`

  if (children.length === 0 || clamped >= children.length) {
    // Insert before the closing tag, on its own line.
    const closeStart = jsx.getClosingElement().getStart()
    const lineStart = sourceText.lastIndexOf("\n", closeStart - 1) + 1
    const anchor =
      sourceText.slice(lineStart, closeStart).trim() === ""
        ? lineStart
        : closeStart
    return { start: anchor, end: anchor, text: block }
  }

  const before = children[clamped]
  if (!before)
    return {
      start: jsx.getClosingElement().getStart(),
      end: jsx.getClosingElement().getStart(),
      text: block,
    }
  const beforeStart = before.getStart()
  const lineStart = sourceText.lastIndexOf("\n", beforeStart - 1) + 1
  const anchor =
    sourceText.slice(lineStart, beforeStart).trim() === ""
      ? lineStart
      : beforeStart
  return { start: anchor, end: anchor, text: block }
}

// ── Printing helpers ────────────────────────────────────────────────

/** Print a new element with deterministic literal props (request order). */
export function printElement(
  component: string,
  props: Readonly<
    Record<string, string | number | boolean | readonly (string | number)[]>
  >,
): string {
  const parts = [component]
  for (const [name, value] of Object.entries(props)) {
    parts.push(`${name}=${printPropValue(value)}`)
  }
  return `<${parts.join(" ")} />`
}

function printPropValue(
  value: string | number | boolean | readonly (string | number)[],
): string {
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" || typeof value === "boolean") {
    return `{${String(value)}}`
  }
  const items = value.map((v) =>
    typeof v === "string" ? JSON.stringify(v) : String(v),
  )
  return `{[${items.join(", ")}]}`
}

function componentName(element: AnyJsxElement): string {
  const tagNode =
    element.getKind() === SyntaxKind.JsxSelfClosingElement
      ? (element as JsxSelfClosingElement).getTagNameNode()
      : (element as JsxElement).getOpeningElement().getTagNameNode()
  return tagNode.getText()
}

function overlaps(a: AnyJsxElement, b: AnyJsxElement): boolean {
  return a.getStart() < b.getEnd() && b.getStart() < a.getEnd()
}

/** When the element is already `const X = (<element/>)`, return `X`. */
function constNameFor(element: AnyJsxElement): string | undefined {
  const decl = element.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
  if (!decl) return undefined
  const init = decl.getInitializer()
  if (!init) return undefined
  const inner =
    init.getKind() === SyntaxKind.ParenthesizedExpression
      ? init.getChildAtIndex(1)
      : init
  if (inner !== element) return undefined
  const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement)
  if (!stmt || stmt.getParentIfKind(SyntaxKind.SourceFile) === undefined) {
    return undefined // only module-level consts are referencable
  }
  return decl.getName()
}

function exportDefaultStart(sf: SourceFile): number {
  for (const stmt of sf.getStatements()) {
    if (stmt.getKind() === SyntaxKind.ExportAssignment) return stmt.getStart()
    const modifiers = (
      stmt.compilerNode as { modifiers?: ts.NodeArray<ts.ModifierLike> }
    ).modifiers
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      return stmt.getStart()
    }
  }
  return sf.getEnd()
}

function toVarName(nodeId: string): string {
  const cleaned = nodeId.replace(/[^a-zA-Z0-9_]/g, "_")
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`
}

function lineIndent(sourceText: string, pos: number): string {
  const lineStart = sourceText.lastIndexOf("\n", pos - 1) + 1
  const line = sourceText.slice(lineStart, pos)
  const match = line.match(/^[ \t]*/)
  return match?.[0] ?? ""
}

/** Re-indent a multi-line element so its continuation lines sit under the
 *  insertion indentation (first line carries the caller's prefix). */
function reindent(elementText: string, indent: string): string {
  const lines = elementText.split("\n")
  if (lines.length === 1) return elementText
  const first = lines[0] ?? ""
  // Strip the COMMON leading indentation of the continuation lines, then
  // re-apply the target indent so relative nesting is preserved.
  const rest = lines.slice(1)
  const common = rest
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => {
      const lead = l.match(/^[ \t]*/)?.[0]?.length ?? 0
      return Math.min(min, lead)
    }, Number.POSITIVE_INFINITY)
  const strip = Number.isFinite(common) ? common : 0
  return [first, ...rest.map((l) => indent + l.slice(strip))].join("\n")
}
