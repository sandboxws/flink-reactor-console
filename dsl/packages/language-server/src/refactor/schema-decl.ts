// Schema-declaration resolution for the rename refactorings.
//
// A column's *identity* is (declaring `Schema({...})` call, field name) — never
// the raw string. This module pins that identity down: it resolves a source
// node's `schema={…}` prop to the declaring call (a local `const`, an import
// from a `schemas/*.ts` module, or an inline literal), gives each declaration a
// stable identity key, and extracts every rename site *inside* the declaration
// — the field key, `primaryKey.columns` entries, and the `watermark`
// column/expression — so renaming a field cannot leave its own schema
// self-inconsistent.
//
// Cross-file declarations are read from disk and edited in the same
// `WorkspaceEdit` (each module's offsets convert against its own parse).

import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
import {
  parseSource,
  readModule,
  resolveBinding,
  resolveModulePath,
} from "../providers/definition/binding.js"
import { findSqlColumnRefs, type OffsetEdit } from "./safety.js"

/** A resolved `Schema({...})` declaration — the unit of column identity. */
export interface SchemaDeclTarget {
  /** Stable identity: `<module path>#<binding>` or `<module path>#inline:<offset>`.
   *  Two sources share a schema iff their keys are equal. */
  readonly key: string
  /** Absolute path of the declaring module (the pipeline file itself for
   *  local and inline declarations). */
  readonly filePath: string
  /** `file://` URI of the declaring module. */
  readonly uri: string
  /** Parse of the declaring module (the pipeline `sf` when local/inline). */
  readonly sf: ts.SourceFile
  /** The `Schema({...})` call expression within `sf`. */
  readonly call: ts.CallExpression
}

/** The dotted/identifier name of a call's callee. */
function calleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text
  }
  return undefined
}

function propertyKeyText(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }
  return undefined
}

/** The `Schema(...)` call bound to a top-level `const <name> = …`, if any. */
function schemaCallForBinding(
  sf: ts.SourceFile,
  bindingName: string,
): ts.CallExpression | undefined {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== bindingName)
        continue
      const init = decl.initializer
      if (
        init &&
        ts.isCallExpression(init) &&
        calleeName(init.expression) === "Schema"
      ) {
        return init
      }
    }
  }
  return undefined
}

/** Identity + edit target for a `Schema(...)` call in a known module: keyed by
 *  the top-level binding when one exists, else by the call's offset (inline). */
export function declTargetForCall(
  call: ts.CallExpression,
  sf: ts.SourceFile,
  filePath: string,
): SchemaDeclTarget {
  // Walk up to a top-level `const X = Schema({...})` binding, if any.
  let cur: ts.Node | undefined = call.parent
  let binding: string | undefined
  while (cur) {
    if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) {
      if (cur.initializer === call) binding = cur.name.text
      break
    }
    // Stop at expression boundaries that mean the call is not a direct
    // initializer (e.g. it sits inside a JSX attribute).
    if (ts.isJsxAttribute(cur) || ts.isSourceFile(cur)) break
    cur = cur.parent
  }
  const key = binding
    ? `${filePath}#${binding}`
    : `${filePath}#inline:${call.getStart(sf)}`
  return { key, filePath, uri: pathToFileURL(filePath).href, sf, call }
}

/**
 * Resolve a source element's `schema={…}` prop to its declaring `Schema(...)`
 * call: an inline call, a local `const`, or one `import` hop into a project
 * module. Returns `undefined` for computed/unresolvable shapes — those sources
 * cannot participate in a rename (the safety boundary).
 */
export function schemaTargetForSource(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
  filePath: string,
  projectDir: string,
): SchemaDeclTarget | undefined {
  for (const prop of el.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    if (name !== "schema") continue
    const init = prop.initializer
    if (!init || !ts.isJsxExpression(init) || !init.expression) return undefined
    const expr = init.expression
    // Inline `schema={Schema({...})}`.
    if (ts.isCallExpression(expr) && calleeName(expr.expression) === "Schema") {
      return declTargetForCall(expr, sf, filePath)
    }
    // `schema={X}` — resolve the binding locally or across one import hop.
    if (!ts.isIdentifier(expr)) return undefined
    const binding = resolveBinding(sf, expr.text)
    if (!binding) return undefined
    if (binding.kind === "local") {
      const call = schemaCallForBinding(sf, expr.text)
      return call ? declTargetForCall(call, sf, filePath) : undefined
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
    const call = schemaCallForBinding(moduleSf, binding.importedName)
    return call ? declTargetForCall(call, moduleSf, modulePath) : undefined
  }
  return undefined
}

/** The `fields` object literal of a `Schema({ fields: {...} })` call. */
function fieldsObject(
  call: ts.CallExpression,
): ts.ObjectLiteralExpression | undefined {
  const options = call.arguments[0]
  if (!options || !ts.isObjectLiteralExpression(options)) return undefined
  for (const prop of options.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (propertyKeyText(prop.name) !== "fields") continue
    if (ts.isObjectLiteralExpression(prop.initializer)) return prop.initializer
  }
  return undefined
}

/** The declared field names of a schema call (statically resolvable keys). */
export function schemaFieldNames(call: ts.CallExpression): Set<string> {
  const names = new Set<string>()
  const fields = fieldsObject(call)
  if (!fields) return names
  for (const prop of fields.properties) {
    if (
      ts.isPropertyAssignment(prop) ||
      ts.isShorthandPropertyAssignment(prop)
    ) {
      const key = propertyKeyText(prop.name)
      if (key) names.add(key)
    }
  }
  return names
}

/** Cursor classification: the field key of a `Schema({ fields: {...} })` the
 *  position sits on, with the enclosing call for identity derivation. */
export interface FieldKeyHit {
  readonly call: ts.CallExpression
  readonly fieldName: string
  /** Offsets of the renamable key token (string-literal keys: the content). */
  readonly start: number
  readonly end: number
}

/** Classify `offset` as a `Schema` field *key*, or `undefined`. */
export function fieldKeyAt(
  sf: ts.SourceFile,
  offset: number,
): FieldKeyHit | undefined {
  let hit: FieldKeyHit | undefined
  const visit = (node: ts.Node): void => {
    if (hit) return
    if (offset < node.getStart(sf) || offset >= node.getEnd()) return
    if (
      ts.isPropertyAssignment(node) &&
      offset >= node.name.getStart(sf) &&
      offset < node.name.getEnd()
    ) {
      const key = propertyKeyText(node.name)
      const fields = node.parent
      if (key && ts.isObjectLiteralExpression(fields)) {
        const fieldsProp = fields.parent
        if (
          ts.isPropertyAssignment(fieldsProp) &&
          propertyKeyText(fieldsProp.name) === "fields" &&
          ts.isObjectLiteralExpression(fieldsProp.parent)
        ) {
          const call = fieldsProp.parent.parent
          if (
            ts.isCallExpression(call) &&
            calleeName(call.expression) === "Schema"
          ) {
            const isString = ts.isStringLiteral(node.name)
            hit = {
              call,
              fieldName: key,
              start: node.name.getStart(sf) + (isString ? 1 : 0),
              end: node.name.getEnd() - (isString ? 1 : 0),
            }
            return
          }
        }
      }
    }
    node.forEachChild(visit)
  }
  sf.forEachChild(visit)
  return hit
}

/**
 * Every rename site *inside* a schema declaration for `oldName`: the field
 * key, each `primaryKey.columns` entry, the `watermark.column`, and column
 * references inside the `watermark.expression` SQL. Offsets are within the
 * declaring module (`target.sf`). Returns no field-key edit when the field is
 * not declared (the caller then refuses the rename).
 */
export function schemaDeclOffsetEdits(
  target: SchemaDeclTarget,
  oldName: string,
  newName: string,
): { fieldKey: OffsetEdit | undefined; rest: OffsetEdit[] } {
  const sf = target.sf
  let fieldKey: OffsetEdit | undefined
  const rest: OffsetEdit[] = []

  const fields = fieldsObject(target.call)
  if (fields) {
    for (const prop of fields.properties) {
      if (
        !ts.isPropertyAssignment(prop) &&
        !ts.isShorthandPropertyAssignment(prop)
      )
        continue
      if (propertyKeyText(prop.name) !== oldName) continue
      const isString = ts.isStringLiteral(prop.name)
      fieldKey = {
        start: prop.name.getStart(sf) + (isString ? 1 : 0),
        end: prop.name.getEnd() - (isString ? 1 : 0),
        newText: newName,
      }
    }
  }

  const options = target.call.arguments[0]
  if (options && ts.isObjectLiteralExpression(options)) {
    for (const prop of options.properties) {
      if (!ts.isPropertyAssignment(prop)) continue
      const key = propertyKeyText(prop.name)
      if (
        key === "primaryKey" &&
        ts.isObjectLiteralExpression(prop.initializer)
      ) {
        rest.push(...pkColumnEdits(prop.initializer, sf, oldName, newName))
      }
      if (
        key === "watermark" &&
        ts.isObjectLiteralExpression(prop.initializer)
      ) {
        rest.push(...watermarkEdits(prop.initializer, sf, oldName, newName))
      }
    }
  }

  return { fieldKey, rest }
}

/** `primaryKey: { columns: ["a", "b"] }` → edits for entries equal to `oldName`. */
function pkColumnEdits(
  pk: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
  oldName: string,
  newName: string,
): OffsetEdit[] {
  const edits: OffsetEdit[] = []
  for (const prop of pk.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (propertyKeyText(prop.name) !== "columns") continue
    if (!ts.isArrayLiteralExpression(prop.initializer)) continue
    for (const element of prop.initializer.elements) {
      if (ts.isStringLiteral(element) && element.text === oldName) {
        edits.push({
          start: element.getStart(sf) + 1,
          end: element.getEnd() - 1,
          newText: newName,
        })
      }
    }
  }
  return edits
}

/** `watermark: { column, expression }` → edits for the column name and the
 *  SQL references inside the expression. */
function watermarkEdits(
  watermark: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
  oldName: string,
  newName: string,
): OffsetEdit[] {
  const edits: OffsetEdit[] = []
  for (const prop of watermark.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = propertyKeyText(prop.name)
    if (!ts.isStringLiteral(prop.initializer)) continue
    const literal = prop.initializer
    if (key === "column" && literal.text === oldName) {
      edits.push({
        start: literal.getStart(sf) + 1,
        end: literal.getEnd() - 1,
        newText: newName,
      })
    }
    if (key === "expression") {
      const contentStart = literal.getStart(sf) + 1
      for (const ref of findSqlColumnRefs(literal.text)) {
        if (ref.name !== oldName) continue
        edits.push({
          start: contentStart + ref.start,
          end: contentStart + ref.start + ref.length,
          newText: newName,
        })
      }
    }
  }
  return edits
}

export function uriToFilePath(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}
