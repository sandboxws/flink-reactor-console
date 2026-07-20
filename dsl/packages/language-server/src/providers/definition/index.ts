// FlinkReactor `textDocument/definition` resolver (schema-navigation, Tier-2).
//
// Extends the Tier-0 definition dispatcher with three FlinkReactor reference
// kinds, classified by where the cursor sits and resolved over the source AST
// (+ the held synthesis graph for the column trace):
//
//   • catalog handle   — `catalog={lake}` → the `…Catalog({…})` that defines it
//   • column reference — a column inside an expression prop → its `Schema()`
//                        field-key declaration (in this file or a `schemas/*.ts`)
//   • component input  — `<Join left={orders} …>` → the node bound to `orders`
//
// Every miss returns `null` (never throws), so the default TypeScript definition
// handler can still try — go-to-definition misses are normal, not errors.

import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
import type { LocationLink, Range } from "vscode-languageserver"
import type { DocumentSynthState } from "../../document-state.js"
import { nodeAtPosition } from "../../mappers/source-position-mapper.js"
import type {
  DecodedEdge,
  NodeProjection,
  SourceRange,
} from "../../synth/types.js"
import { classifyCompletion } from "../completion/context.js"
import {
  attrIdentifier,
  deepestNodeAt,
  elementAtRangeStart,
  findAncestor,
  findProjectRoot,
  findSchemaDecl,
  isOpeningTag,
  offsetAt,
  parseSource,
  readModule,
  resolveBinding,
  resolveModulePath,
  toRange,
} from "./binding.js"

/** Props whose value is a `CatalogHandle` — the catalog-handle definition case. */
const CATALOG_PROPS = new Set(["catalog"])

/** Props whose value references another construct node by variable — the
 *  component-input definition case (`Join`/`IntervalJoin` `left`/`right`,
 *  `TemporalJoin` `stream`/`temporal`, `LookupJoin` `input`, a transform
 *  `source`). */
const NODE_REF_PROPS = new Set([
  "left",
  "right",
  "source",
  "input",
  "stream",
  "temporal",
])

export interface DefinitionInput {
  readonly state: DocumentSynthState | undefined
  readonly sourceText: string
  /** The pipeline document's `file://` URI. */
  readonly uri: string
  readonly position: { readonly line: number; readonly character: number }
}

/**
 * Resolve a FlinkReactor reference under the cursor to its source definition,
 * or `null` when the cursor is not on a navigable reference / the target cannot
 * be resolved (computed handle, untraceable column, SQL keyword).
 */
export function provideDefinition(
  input: DefinitionInput,
): LocationLink[] | null {
  const filePath = uriToPath(input.uri)
  if (!filePath) return null
  const projectDir = findProjectRoot(filePath)
  const sf = parseSource(input.sourceText, filePath)
  const offset = offsetAt(sf, input.position)
  if (offset === undefined) return null
  const node = deepestNodeAt(sf, offset)

  return (
    resolvePropReference(sf, node, offset, filePath, projectDir) ??
    resolveColumnReference(input, sf, filePath, projectDir)
  )
}

// ── Catalog-handle + component-input (prop value → declaration) ──────────

/**
 * A `catalog={…}` or node-input (`left`/`right`/`source`/…) prop value resolves
 * to the declaration of the variable it references — uniform because both are a
 * `prop={identifier}` whose identifier names a `const` (a `…Catalog({…})` call
 * or a `<Source/>` JSX). A computed/inline value (a call, a member of something
 * unresolvable) yields no identifier and so no result.
 */
function resolvePropReference(
  sf: ts.SourceFile,
  node: ts.Node,
  offset: number,
  filePath: string,
  projectDir: string,
): LocationLink[] | null {
  const attr = findAncestor(node, ts.isJsxAttribute)
  if (!attr) return null
  const name = ts.isIdentifier(attr.name)
    ? attr.name.text
    : attr.name.getText(sf)
  if (!CATALOG_PROPS.has(name) && !NODE_REF_PROPS.has(name)) return null
  // The cursor must be inside the attribute's value, not its name.
  const init = attr.initializer
  if (!init || offset < init.getStart(sf) || offset > init.getEnd()) return null
  const el = findAncestor(attr, isOpeningTag)
  if (!el) return null
  const ref = attrIdentifier(el, name, sf)
  if (!ref) return null
  const target = followToDeclaration(ref.base, sf, filePath, projectDir)
  if (!target) return null
  return [link(target.uri, target.range, ref.valueRange)]
}

/**
 * Resolve a top-level binding to the source location of its initializer,
 * following a single `import` hop into a project module. Returns the
 * initializer's range (the `…Catalog({…})` call, the `<Source/>` JSX, …) — the
 * definition a "jump to where this is defined" expects.
 */
function followToDeclaration(
  base: string,
  sf: ts.SourceFile,
  filePath: string,
  projectDir: string,
): { uri: string; range: SourceRange } | undefined {
  const binding = resolveBinding(sf, base)
  if (!binding) return undefined
  if (binding.kind === "local") {
    return {
      uri: pathToUri(filePath),
      range: toRange(sf, binding.init.getStart(sf), binding.init.getEnd()),
    }
  }
  // Imported: follow into the module and resolve its local declaration.
  const modulePath = resolveModulePath(
    binding.moduleSpecifier,
    filePath,
    projectDir,
  )
  if (!modulePath) return undefined
  const text = readModule(modulePath)
  if (!text) return undefined
  const moduleSf = parseSource(text, modulePath)
  const inner = resolveBinding(moduleSf, binding.importedName)
  if (inner?.kind !== "local") return undefined
  return {
    uri: pathToUri(modulePath),
    range: toRange(
      moduleSf,
      inner.init.getStart(moduleSf),
      inner.init.getEnd(),
    ),
  }
}

// ── Column reference → upstream Schema field ─────────────────────────────

function resolveColumnReference(
  input: DefinitionInput,
  sf: ts.SourceFile,
  filePath: string,
  projectDir: string,
): LocationLink[] | null {
  const ctx = classifyCompletion(input.sourceText, filePath, input.position)
  if (!ctx || ctx.kind !== "column-ref") return null
  const column = ctx.partial
  if (!column) return null

  const state = input.state
  if (!state) return null

  // The node owning the expression under the cursor (the innermost mapped node).
  const owningId = nodeAtPosition(state.positionMap, input.position)
  if (!owningId) return null

  const alias = aliasBefore(input.sourceText, sf, ctx.replace)
  const sources = upstreamSources(
    owningId,
    state.result.dagEdges,
    state.result.nodes,
  )

  // A qualified `alias.column` prefers the join input bound to `alias`; an
  // ambiguous bare column resolves to the first upstream source that declares
  // it (documented parity with the superseded IntelliJ behavior).
  const ordered = alias
    ? prioritizeAliasSource(sources, alias, owningId, sf, state)
    : sources

  for (const sourceId of ordered) {
    const hit = fieldLocationForSource(
      sourceId,
      column,
      sf,
      filePath,
      projectDir,
      state,
    )
    if (hit) return [link(hit.uri, hit.range, rangeOf(ctx.replace))]
  }
  return null
}

/**
 * Resolve `column` to its field-key declaration in the upstream source's
 * `schema={…}` binding.
 */
function fieldLocationForSource(
  sourceId: string,
  column: string,
  sf: ts.SourceFile,
  filePath: string,
  projectDir: string,
  state: DocumentSynthState,
): { uri: string; range: SourceRange } | undefined {
  const range = state.positionMap.map.get(sourceId)
  if (!range) return undefined
  const loc = resolveSourceSchemaFields({
    sf,
    filePath,
    projectDir,
    sourceRange: range,
  })
  const fieldRange = loc?.fields.get(column)
  return loc && fieldRange ? { uri: loc.uri, range: fieldRange } : undefined
}

/** A located schema declaration: its file URI and each field key's range. */
export interface SchemaFieldLocations {
  readonly uri: string
  readonly fields: ReadonlyMap<string, SourceRange>
}

/**
 * Resolve a source node's `schema={X}` binding to its `Schema({ fields })`
 * declaration and the source range of every field key — `Schema(...)` either
 * inline in the pipeline or imported from a `schemas/*.ts` module. Shared by the
 * column-definition resolver and the `schemaTree` builder so both follow the
 * same cross-file resolution rules. `sourceRange` is the source node's mapped
 * JSX range (from the `nodeId → Range` source map).
 */
export function resolveSourceSchemaFields(opts: {
  readonly sf: ts.SourceFile
  readonly filePath: string
  readonly projectDir: string
  readonly sourceRange: SourceRange
}): SchemaFieldLocations | undefined {
  const { sf, filePath, projectDir, sourceRange } = opts
  const el = elementAtRangeStart(sf, sourceRange)
  if (!el) return undefined
  const schemaRef = attrIdentifier(el, "schema", sf)
  if (!schemaRef) return undefined

  const binding = resolveBinding(sf, schemaRef.base)
  if (!binding) return undefined
  if (binding.kind === "local") {
    const decl = findSchemaDecl(sf, schemaRef.base)
    return decl ? { uri: pathToUri(filePath), fields: decl.fields } : undefined
  }
  const modulePath = resolveModulePath(
    binding.moduleSpecifier,
    filePath,
    projectDir,
  )
  if (!modulePath) return undefined
  const text = readModule(modulePath)
  if (!text) return undefined
  const moduleSf = parseSource(text, modulePath)
  const decl = findSchemaDecl(moduleSf, binding.importedName)
  return decl ? { uri: pathToUri(modulePath), fields: decl.fields } : undefined
}

/** BFS upstream over the DAG, collecting Source nodes nearest-first. */
function upstreamSources(
  startId: string,
  edges: readonly DecodedEdge[],
  nodes: readonly NodeProjection[],
): string[] {
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.to)
    if (list) list.push(e.from)
    else incoming.set(e.to, [e.from])
  }
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const sources: string[] = []
  const seen = new Set<string>([startId])
  let frontier = incoming.get(startId) ?? []
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      if (kindOf.get(id) === "Source") sources.push(id)
      next.push(...(incoming.get(id) ?? []))
    }
    frontier = next
  }
  return sources
}

/**
 * Move the source bound to a join input named `alias` to the front. The owning
 * node (or its enclosing join) holds `left={alias}`/`right={alias}`/… — that
 * variable's JSX initializer is the aliased source. Best-effort: an unresolved
 * alias leaves the order unchanged.
 */
function prioritizeAliasSource(
  sources: string[],
  alias: string,
  owningId: string,
  sf: ts.SourceFile,
  state: DocumentSynthState,
): string[] {
  // The owning element is the join (its `on`/condition holds the cursor).
  const range = state.positionMap.map.get(owningId)
  if (!range) return sources
  const el = elementAtRangeStart(sf, range)
  if (!el) return sources
  // The alias names a join-input prop bound to a variable whose initializer is
  // the source JSX; match that source by its mapped range.
  for (const prop of NODE_REF_PROPS) {
    const ref = attrIdentifier(el, prop, sf)
    if (ref?.base !== alias) continue
    const binding = resolveBinding(sf, alias)
    if (binding?.kind !== "local") continue
    const initStart = binding.init.getStart(sf)
    for (const sourceId of sources) {
      const r = state.positionMap.map.get(sourceId)
      if (r && offsetAt(sf, r.start) === initStart) {
        return [sourceId, ...sources.filter((s) => s !== sourceId)]
      }
    }
  }
  return sources
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** The `alias` in `alias.column` immediately preceding `replace`, if any. */
function aliasBefore(
  sourceText: string,
  sf: ts.SourceFile,
  replace: SourceRange,
): string | undefined {
  const start = offsetAt(sf, replace.start)
  if (start === undefined) return undefined
  let i = start
  if (sourceText[i - 1] === "`") i -= 1 // skip a leading back-quote
  if (sourceText[i - 1] !== ".") return undefined
  i -= 1
  let end = i
  if (sourceText[i - 1] === "`") {
    i -= 1
    end = i
  }
  const isWord = (c: string): boolean => /[A-Za-z0-9_$]/.test(c)
  let s = i
  while (s > 0 && isWord(sourceText[s - 1])) s -= 1
  const alias = sourceText.slice(s, end)
  return alias.length > 0 ? alias : undefined
}

function link(
  uri: string,
  target: SourceRange,
  origin: SourceRange,
): LocationLink {
  const range = rangeOf(target)
  return {
    targetUri: uri,
    targetRange: range,
    targetSelectionRange: range,
    originSelectionRange: rangeOf(origin),
  }
}

/** `SourceRange` and LSP `Range` are structurally identical; convert explicitly
 *  so the wire type is unambiguous. */
function rangeOf(r: SourceRange): Range {
  return {
    start: { line: r.start.line, character: r.start.character },
    end: { line: r.end.line, character: r.end.character },
  }
}

function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}

function pathToUri(path: string): string {
  return pathToFileURL(path).href
}
