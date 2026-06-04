// Schema-aware column rename (component-refactoring, Tier-3 feature 14).
//
// Renaming a field declared in a `Schema({ fields })` rewrites the field
// declaration (key + same-schema `primaryKey`/`watermark` mentions) and every
// downstream reference the column actually reaches — never an identically
// named column from an unrelated schema. The scope is a projection of facts
// synthesis already computed:
//
//   • Which sources use the renamed schema — each source's `schema={…}` prop
//     resolves (local / one import hop / inline) to a declaring call; two
//     sources share a schema iff they resolve to the same declaration.
//   • Where the column flows — BFS downstream over the decoded `dagEdges`,
//     stopping at *projection* components (`Map`/`Aggregate`/`Query`): a
//     projection owns its output column names (its `select`/`columns` keys),
//     so a schema column's identity never survives past one. Config sub-nodes
//     with no dataflow edge of their own (`Query.Select` inside a `Query`)
//     inherit visibility from the node whose mapped range encloses them —
//     mirroring the worker's parent-fallback for `nodeInputSchemas`.
//   • Which tokens to rewrite — the component's `EXPRESSION_PROPS` slots,
//     walked over the live AST: back-quoted and bare identifiers inside
//     verbatim-SQL strings, whole-string column names in bare slots
//     (`groupBy[]`, `key[]`, `order#`), and record keys in `{}` slots.
//
// Ambiguity is refusal: a node reachable from BOTH the renamed schema's flow
// and an unrelated schema declaring the same column name is excluded from the
// edit set (and when the *invoked* reference itself is ambiguous, the whole
// rename returns no edit).

import ts from "typescript"
import type { Range, WorkspaceEdit } from "vscode-languageserver"
import type { DocumentSynthState } from "../document-state.js"
import { columnSlotsFor, type Descent } from "../expression-props.js"
import {
  nodeAtPosition,
  type PositionMap,
} from "../mappers/source-position-mapper.js"
import { classifyCompletion } from "../providers/completion/context.js"
import {
  elementAtRangeStart,
  findProjectRoot,
  offsetAt,
  parseSource,
} from "../providers/definition/binding.js"
import type { DecodedEdge, SourceRange } from "../synth/types.js"
import {
  findSqlColumnRefs,
  isValidIdentifier,
  type OffsetEdit,
  type OpeningTag,
  toTextEdits,
} from "./safety.js"
import {
  declTargetForCall,
  fieldKeyAt,
  type SchemaDeclTarget,
  schemaDeclOffsetEdits,
  schemaFieldNames,
  schemaTargetForSource,
  uriToFilePath,
} from "./schema-decl.js"

export interface RefactorInput {
  readonly state: DocumentSynthState | undefined
  readonly sourceText: string
  /** The pipeline document's `file://` URI. */
  readonly uri: string
  readonly position: { readonly line: number; readonly character: number }
}

/** A classified column-rename target under the cursor. */
export interface ColumnRenameTarget {
  readonly kind: "schema-column"
  readonly oldName: string
  /** Precise range of the renamable token (field key, or the column word
   *  inside the expression — backticks excluded). */
  readonly range: Range
  /** The declaring schema — the column's identity. */
  readonly decl: SchemaDeclTarget
  /** Set when the target was a reference site: the owning node, used to
   *  verify the invoked site itself lands in the unambiguous edit set. */
  readonly owningNodeId?: string
}

/** Components whose output column names are their own (`select`/`columns`
 *  keys) — a schema column's identity stops at them. */
const PROJECTION_COMPONENTS: ReadonlySet<string> = new Set([
  "Map",
  "Aggregate",
  "Query",
])

/**
 * Classify the position as a renamable schema column: either the field key in
 * a `Schema({ fields })` literal, or a column reference inside an expression
 * prop that resolves (via the synthesis graph) to a schema field. Returns
 * `null` for everything else — SQL keywords, literals, unresolvable tokens.
 */
export function columnRenameTargetAt(
  input: RefactorInput,
): ColumnRenameTarget | null {
  const filePath = uriToFilePath(input.uri)
  if (!filePath) return null
  const sf = parseSource(input.sourceText, filePath)
  const offset = offsetAt(sf, input.position)
  if (offset === undefined) return null

  // ── Case A: the field key inside a Schema({ fields }) literal ──────
  const key = fieldKeyAt(sf, offset)
  if (key) {
    return {
      kind: "schema-column",
      oldName: key.fieldName,
      range: rangeOf(sf, key.start, key.end),
      decl: declTargetForCall(key.call, sf, filePath),
    }
  }

  // ── Case B: a column reference inside an expression prop ───────────
  const state = input.state
  if (!state) return null
  const ctx = classifyCompletion(input.sourceText, filePath, input.position)
  if (!ctx || ctx.kind !== "column-ref" || !ctx.partial) return null
  const owningNodeId = nodeAtPosition(state.positionMap, input.position)
  if (!owningNodeId) return null

  const projectDir = findProjectRoot(filePath)
  const sources = sourceSchemaIndex(state, sf, filePath, projectDir)
  const ordered = upstreamSourceIds(
    owningNodeId,
    state.result.dagEdges,
    sources,
  )
  for (const sourceId of ordered) {
    const decl = sources.get(sourceId)
    if (decl && schemaFieldNames(decl.call).has(ctx.partial)) {
      return {
        kind: "schema-column",
        oldName: ctx.partial,
        range: wordRange(sf, input.sourceText, ctx.replace, ctx.partial),
        decl,
        owningNodeId,
      }
    }
  }
  return null
}

/**
 * Build the rename `WorkspaceEdit` for a classified column target, or `null`
 * when no safe edit exists (invalid new name, undeclared field, or an
 * ambiguous invoked site). The edit spans the pipeline document and — for a
 * schema declared in a `schemas/*.ts` module — the declaring module.
 */
export function renameSchemaColumn(
  input: RefactorInput,
  target: ColumnRenameTarget,
  newName: string,
): WorkspaceEdit | null {
  if (!isValidIdentifier(newName) || newName === target.oldName) return null
  const state = input.state
  if (!state) return null
  const filePath = uriToFilePath(input.uri)
  if (!filePath) return null
  const sf = parseSource(input.sourceText, filePath)
  const projectDir = findProjectRoot(filePath)

  // The declaration-side edits gate the rename: no declared field, no rename.
  const declEdits = schemaDeclOffsetEdits(target.decl, target.oldName, newName)
  if (!declEdits.fieldKey) return null

  // Partition the document's sources: those sharing the renamed declaration
  // vs. unrelated schemas that also declare a column with the same name.
  const sources = sourceSchemaIndex(state, sf, filePath, projectDir)
  const renamedSourceIds: string[] = []
  const unrelatedSourceIds: string[] = []
  for (const [sourceId, decl] of sources) {
    if (!schemaFieldNames(decl.call).has(target.oldName)) continue
    if (decl.key === target.decl.key) renamedSourceIds.push(sourceId)
    else unrelatedSourceIds.push(sourceId)
  }
  // A source whose schema could not be resolved but which synthesis says
  // declares the column is treated as unrelated — its flow is excluded
  // (refuse rather than guess).
  for (const table of state.result.tableSchemas) {
    if (table.role !== "source" || sources.has(table.nodeId)) continue
    if (table.fields.some((f) => f.name === target.oldName)) {
      unrelatedSourceIds.push(table.nodeId)
    }
  }

  const renamedReach = flowVisibility(
    renamedSourceIds,
    state.result.dagEdges,
    componentIndex(state),
    state.positionMap,
  )
  const unrelatedReach = flowVisibility(
    unrelatedSourceIds,
    state.result.dagEdges,
    componentIndex(state),
    state.positionMap,
  )
  const editable = [...renamedReach].filter((id) => !unrelatedReach.has(id))

  // The site the user invoked rename on must itself be editable; otherwise
  // the rename would silently skip the very reference under the cursor.
  if (target.owningNodeId && !editable.includes(target.owningNodeId)) {
    return null
  }

  // ── Reference-site edits in the pipeline document ───────────────────
  const docEdits: OffsetEdit[] = []
  const componentOf = componentIndex(state)
  for (const nodeId of editable) {
    const component = componentOf.get(nodeId)
    const range = state.positionMap.map.get(nodeId)
    if (!component || !range) continue
    const el = elementAtRangeStart(sf, range)
    if (!el) continue // factory-call / unmapped node — refuse that site
    docEdits.push(
      ...referenceOffsetEdits(el, component, target.oldName, newName, sf),
    )
  }

  // ── Assemble per-URI, merging the declaration edits ─────────────────
  const byUri = new Map<string, OffsetEdit[]>()
  const push = (uri: string, edits: readonly OffsetEdit[]): void => {
    if (edits.length === 0) return
    const list = byUri.get(uri) ?? []
    list.push(...edits)
    byUri.set(uri, list)
  }
  push(input.uri, docEdits)
  push(target.decl.uri, [declEdits.fieldKey, ...declEdits.rest])

  const changes: Record<string, ReturnType<typeof toTextEdits>> = {}
  for (const [uri, edits] of byUri) {
    const moduleSf = uri === input.uri ? sf : target.decl.sf
    changes[uri] = toTextEdits(moduleSf, edits)
  }
  return { changes }
}

// ── Schema-flow visibility ───────────────────────────────────────────

/**
 * The nodes that see a column from `seedSourceIds` as *input*: BFS downstream
 * over the dataflow edges, where a node carries the column onward unless it is
 * a projection (whose output names are its own keys). Nodes with no dataflow
 * edge whose mapped range nests inside a visible node's range (config
 * sub-nodes like `Query.Select`) inherit visibility from their host.
 */
function flowVisibility(
  seedSourceIds: readonly string[],
  edges: readonly DecodedEdge[],
  componentOf: ReadonlyMap<string, string>,
  positionMap: PositionMap,
): Set<string> {
  const out = new Map<string, string[]>()
  const hasIncoming = new Set<string>()
  for (const e of edges) {
    const list = out.get(e.from)
    if (list) list.push(e.to)
    else out.set(e.from, [e.to])
    hasIncoming.add(e.to)
  }

  const visible = new Set<string>()
  const carriers = new Set<string>(seedSourceIds)
  const queue = [...seedSourceIds]
  while (queue.length > 0) {
    const u = queue.shift()
    if (u === undefined) break
    for (const v of out.get(u) ?? []) {
      visible.add(v)
      if (carriers.has(v)) continue
      const component = componentOf.get(v)
      if (component && !PROJECTION_COMPONENTS.has(component)) {
        carriers.add(v)
        queue.push(v)
      }
    }
  }

  // Config sub-nodes (no dataflow edges) inherit their host's visibility via
  // range containment — the host-side analog of the worker's parent fallback.
  for (const [id, range] of positionMap.map) {
    if (visible.has(id) || hasIncoming.has(id)) continue
    for (const host of visible) {
      const hostRange = positionMap.map.get(host)
      if (hostRange && containsRange(hostRange, range)) {
        visible.add(id)
        break
      }
    }
  }
  return visible
}

function containsRange(outer: SourceRange, inner: SourceRange): boolean {
  const startsBefore =
    outer.start.line < inner.start.line ||
    (outer.start.line === inner.start.line &&
      outer.start.character <= inner.start.character)
  const endsAfter =
    outer.end.line > inner.end.line ||
    (outer.end.line === inner.end.line &&
      outer.end.character >= inner.end.character)
  // Strictly smaller: a range does not "contain" itself.
  const sameSpan =
    outer.start.line === inner.start.line &&
    outer.start.character === inner.start.character &&
    outer.end.line === inner.end.line &&
    outer.end.character === inner.end.character
  return startsBefore && endsAfter && !sameSpan
}

// ── Reference-site extraction ────────────────────────────────────────

/**
 * The rename edits inside one component element, driven by its declared
 * `EXPRESSION_PROPS` slots: SQL-expression strings are scanned for back-quoted
 * and bare references; bare slots (`[]` elements, `#` scalars) match the whole
 * string; `{}` slots match record keys. Computed/spread shapes yield nothing.
 */
function referenceOffsetEdits(
  el: OpeningTag,
  component: string,
  oldName: string,
  newName: string,
  sf: ts.SourceFile,
): OffsetEdit[] {
  const edits: OffsetEdit[] = []
  for (const slot of columnSlotsFor(component)) {
    const root = attrValueExpression(el, slot.prop, sf)
    if (!root) continue
    for (const terminal of walkDescents(root, slot.descents)) {
      if (slot.slot === "key") {
        if (!ts.isObjectLiteralExpression(terminal)) continue
        for (const prop of terminal.properties) {
          if (!ts.isPropertyAssignment(prop)) continue
          const name = prop.name
          if (ts.isIdentifier(name) && name.text === oldName) {
            edits.push({
              start: name.getStart(sf),
              end: name.getEnd(),
              newText: newName,
            })
          } else if (ts.isStringLiteral(name) && name.text === oldName) {
            edits.push({
              start: name.getStart(sf) + 1,
              end: name.getEnd() - 1,
              newText: newName,
            })
          }
        }
        continue
      }
      if (!isStringLike(terminal)) continue
      const contentStart = terminal.getStart(sf) + 1
      if (slot.quote === "backtick") {
        for (const ref of findSqlColumnRefs(terminal.text)) {
          if (ref.name !== oldName) continue
          edits.push({
            start: contentStart + ref.start,
            end: contentStart + ref.start + ref.length,
            newText: newName,
          })
        }
      } else if (terminal.text === oldName) {
        edits.push({
          start: contentStart,
          end: terminal.getEnd() - 1,
          newText: newName,
        })
      }
    }
  }
  return edits
}

/** The expression carried by `prop`'s initializer (`="x"` → the literal,
 *  `={expr}` → the expression), or `undefined` for boolean/spread shapes. */
function attrValueExpression(
  el: OpeningTag,
  prop: string,
  sf: ts.SourceFile,
): ts.Expression | undefined {
  for (const attribute of el.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    const name = ts.isIdentifier(attribute.name)
      ? attribute.name.text
      : attribute.name.getText(sf)
    if (name !== prop) continue
    const init = attribute.initializer
    if (!init) return undefined
    if (ts.isStringLiteral(init)) return init
    if (ts.isJsxExpression(init)) return init.expression
    return undefined
  }
  return undefined
}

/** Walk a slot's declared descents over the live AST, yielding the terminal
 *  value node(s) — string literals for `value` slots, the container object for
 *  `key` slots. Computed shapes simply yield nothing (the safety boundary). */
function walkDescents(
  root: ts.Expression,
  descents: readonly Descent[],
): ts.Expression[] {
  let frontier: ts.Expression[] = [root]
  for (const descent of descents) {
    const next: ts.Expression[] = []
    for (const node of frontier) {
      if (descent.kind === "element") {
        if (ts.isArrayLiteralExpression(node)) {
          for (const element of node.elements) next.push(element)
        }
        continue
      }
      if (!ts.isObjectLiteralExpression(node)) continue
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        if (descent.kind === "key") {
          const key = ts.isIdentifier(prop.name)
            ? prop.name.text
            : ts.isStringLiteral(prop.name)
              ? prop.name.text
              : undefined
          if (key !== descent.name) continue
        }
        next.push(prop.initializer)
      }
    }
    frontier = next
  }
  return frontier
}

function isStringLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

// ── Source/graph indexes ─────────────────────────────────────────────

/** Each source node's resolved schema declaration (unresolvable ones absent). */
function sourceSchemaIndex(
  state: DocumentSynthState,
  sf: ts.SourceFile,
  filePath: string,
  projectDir: string,
): Map<string, SchemaDeclTarget> {
  const index = new Map<string, SchemaDeclTarget>()
  for (const node of state.result.nodes) {
    if (node.kind !== "Source") continue
    const range = state.positionMap.map.get(node.id)
    if (!range) continue
    const el = elementAtRangeStart(sf, range)
    if (!el) continue
    const decl = schemaTargetForSource(el, sf, filePath, projectDir)
    if (decl) index.set(node.id, decl)
  }
  return index
}

function componentIndex(state: DocumentSynthState): Map<string, string> {
  return new Map(state.result.nodes.map((n) => [n.id, n.component]))
}

/** Source ids upstream of `startId`, nearest-first (BFS over incoming edges) —
 *  the same resolution order go-to-definition documents for ambiguous bare
 *  columns. */
function upstreamSourceIds(
  startId: string,
  edges: readonly DecodedEdge[],
  sources: ReadonlyMap<string, SchemaDeclTarget>,
): string[] {
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.to)
    if (list) list.push(e.from)
    else incoming.set(e.to, [e.from])
  }
  const ordered: string[] = []
  const seen = new Set<string>([startId])
  let frontier = incoming.get(startId) ?? []
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      if (sources.has(id)) ordered.push(id)
      next.push(...(incoming.get(id) ?? []))
    }
    frontier = next
  }
  return ordered
}

// ── Range helpers ────────────────────────────────────────────────────

function rangeOf(sf: ts.SourceFile, start: number, end: number): Range {
  return {
    start: sf.getLineAndCharacterOfPosition(start),
    end: sf.getLineAndCharacterOfPosition(end),
  }
}

/** The word-only range for a classified reference: `classifyCompletion`'s
 *  `replace` range grows to include surrounding backticks for backtick slots —
 *  shrink it back to the identifier itself so prepareRename highlights (and
 *  rename replaces) exactly the word. */
function wordRange(
  sf: ts.SourceFile,
  sourceText: string,
  replace: SourceRange,
  word: string,
): Range {
  let start = offsetAt(sf, replace.start) ?? 0
  let end = offsetAt(sf, replace.end) ?? start
  if (sourceText[start] === "`") start += 1
  if (end > start && sourceText[end - 1] === "`") end -= 1
  // Defensive: the trimmed span should hold exactly the word.
  if (sourceText.slice(start, end) !== word) {
    const at = sourceText.indexOf(word, start)
    if (at >= 0 && at <= end) {
      start = at
      end = at + word.length
    }
  }
  return rangeOf(sf, start, end)
}
