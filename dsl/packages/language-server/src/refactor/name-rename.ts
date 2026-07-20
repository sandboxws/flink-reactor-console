// Pipeline / node `name` rename (component-refactoring, Tier-3 feature 14).
//
// A node's identity in the DAG is its `ConstructNode`; renaming its `name`
// prop rewrites the declaration plus each dependent reference that *resolves
// to that node* — never every string equal to the old name. Dependents are
// resolved the way the synthesis side resolves name references (the worker's
// source-name index): a *reference-bearing* prop (`table`/`from`/`source`)
// whose literal value equals the node's authoritative `name` (decoded onto
// `NodeProjection.name` by the worker). An unrelated literal — a topic, a SQL
// condition, another node's own `name` — is left alone.
//
// Refusals (no edit) follow the shared safety contract: a computed `name`
// value, a name shared by two nodes (ambiguous references), or an invalid
// identifier as the new name.

import ts from "typescript"
import type { Range, WorkspaceEdit } from "vscode-languageserver"
import { toSqlIdentifier } from "../mappers/id-predictor.js"
import {
  elementAtRangeStart,
  findAncestor,
  isOpeningTag,
  offsetAt,
  parseSource,
} from "../providers/definition/binding.js"
import {
  attrStringLiteral,
  isValidIdentifier,
  literalAttrs,
  type OffsetEdit,
  toTextEdits,
} from "./safety.js"
import { uriToFilePath } from "./schema-decl.js"
import type { RefactorInput } from "./schema-rename.js"

/** Props whose literal string value references another node by `name`. Only
 *  `from` — the documented table-reference pattern (`View`'s "used as table
 *  reference in downstream `from` props") — qualifies today: `table` on a
 *  sink/`LookupJoin` names an *external* database table and `topic`/SQL
 *  strings are data, so the positive list keeps them from being mistaken for
 *  node references (spec: "do not text-match unrelated literals"). */
const NAME_REF_PROPS: ReadonlySet<string> = new Set(["from"])

export interface NameRenameTarget {
  readonly kind: "node-name"
  readonly nodeId: string
  readonly oldName: string
  /** The string content range of the `name` attribute's value. */
  readonly range: Range
}

/**
 * Classify the position as a node/pipeline `name` value: the cursor must sit
 * inside the string literal of a `name="…"` attribute whose element maps to a
 * synthesized node carrying that name. Returns `null` otherwise (computed
 * values included — the safety boundary).
 */
export function nameRenameTargetAt(
  input: RefactorInput,
): NameRenameTarget | null {
  const state = input.state
  if (!state) return null
  const filePath = uriToFilePath(input.uri)
  if (!filePath) return null
  const sf = parseSource(input.sourceText, filePath)
  const offset = offsetAt(sf, input.position)
  if (offset === undefined) return null

  const node = deepestNodeAt(sf, offset)
  const attr = findAncestor(node, ts.isJsxAttribute)
  if (!attr) return null
  const attrName = ts.isIdentifier(attr.name)
    ? attr.name.text
    : attr.name.getText(sf)
  if (attrName !== "name") return null
  const literal = attrStringLiteral(attr)
  if (!literal) return null
  const innerStart = literal.getStart(sf) + 1
  const innerEnd = literal.getEnd() - 1
  if (offset < innerStart || offset > innerEnd) return null

  const el = findAncestor(attr, isOpeningTag)
  if (!el) return null

  // Pair the element with its synthesized node by the mapped range start —
  // exact, unlike innermost-containment (a parent's range also contains the
  // attribute position).
  const elStart = el.getStart(sf)
  let nodeId: string | undefined
  for (const [id, range] of state.positionMap.map) {
    if (offsetAt(sf, range.start) === elStart) {
      nodeId = id
      break
    }
  }
  if (!nodeId) return null
  const projection = state.result.nodes.find((n) => n.id === nodeId)
  // The declared name survives the worker boundary either as the decoded
  // `name` prop (Pipeline, transforms) or — for name-hint components, whose
  // factories consume `name` into `_nameHint` — as the node *id* derived from
  // it (`toSqlIdentifier(name)`, possibly de-dup-suffixed).
  if (!projection || !carriesName(projection, literal.text)) return null

  return {
    kind: "node-name",
    nodeId,
    oldName: literal.text,
    range: {
      start: sf.getLineAndCharacterOfPosition(innerStart),
      end: sf.getLineAndCharacterOfPosition(innerEnd),
    },
  }
}

/**
 * Build the rename `WorkspaceEdit`: the node's `name` value plus each
 * dependent reference-bearing prop (on other mapped nodes) whose literal value
 * resolves to the renamed node. Returns `null` when the name is shared by
 * another node (ambiguous) or the new name is not a valid identifier.
 */
export function renameNodeName(
  input: RefactorInput,
  target: NameRenameTarget,
  newName: string,
): WorkspaceEdit | null {
  if (!isValidIdentifier(newName) || newName === target.oldName) return null
  const state = input.state
  if (!state) return null
  const filePath = uriToFilePath(input.uri)
  if (!filePath) return null
  const sf = parseSource(input.sourceText, filePath)

  const edits: OffsetEdit[] = []

  // One pass over the mapped elements: re-locate the declaration's `name`
  // attribute, collect dependent reference props, and count other elements
  // declaring the same name (two `name="X"` declarations make every "X"
  // reference ambiguous → refuse the whole rename).
  let declared = false
  const dependentEdits: OffsetEdit[] = []
  for (const [nodeId, range] of state.positionMap.map) {
    const el = elementAtRangeStart(sf, range)
    if (!el) continue
    for (const attr of literalAttrs(el, sf)) {
      if (nodeId === target.nodeId) {
        if (attr.name === "name" && attr.text === target.oldName) {
          declared = true
          edits.push({
            start: attr.innerStart,
            end: attr.innerEnd,
            newText: newName,
          })
        }
        continue
      }
      if (attr.name === "name" && attr.text === target.oldName) {
        return null // duplicate declaration — ambiguous references
      }
      if (NAME_REF_PROPS.has(attr.name) && attr.text === target.oldName) {
        dependentEdits.push({
          start: attr.innerStart,
          end: attr.innerEnd,
          newText: newName,
        })
      }
    }
  }
  if (!declared) return null
  edits.push(...dependentEdits)

  return { changes: { [input.uri]: toTextEdits(sf, edits) } }
}

/** Does the synthesized projection carry `name` as its declared name — the
 *  decoded `name` prop, or the name-hint-derived id (`toSqlIdentifier(name)`
 *  with an optional `_N` de-dup suffix)? */
function carriesName(
  projection: { readonly id: string; readonly name?: string },
  name: string,
): boolean {
  if (projection.name === name) return true
  const base = toSqlIdentifier(name)
  return projection.id === base || projection.id.startsWith(`${base}_`)
}

/** The deepest AST node whose span contains `offset`. */
function deepestNodeAt(sf: ts.SourceFile, offset: number): ts.Node {
  let deepest: ts.Node = sf
  const visit = (n: ts.Node): void => {
    if (offset >= n.getStart(sf) && offset < n.getEnd()) {
      deepest = n
      n.forEachChild(visit)
    }
  }
  sf.forEachChild(visit)
  return deepest
}
