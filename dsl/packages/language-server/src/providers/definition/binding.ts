// Source-level binding resolution for FlinkReactor go-to-definition.
//
// FlinkReactor references are *structural at runtime* but the runtime objects
// (a `CatalogHandle`'s `nodeId`, a `SchemaDefinition`) never cross the synthesis
// worker boundary, and catalogs/schemas are authored as plain function calls
// bound to variables (`const lake = IcebergCatalog({…})`, `const OrdersSchema =
// Schema({ fields })`) rather than JSX — so the `nodeId → Range` source map does
// not cover them. Definition therefore resolves over the *source AST*: from a
// prop value's identifier to the declaration that produced it, following an
// `import { … } from "@/schemas/…"` into the schema module when needed.
//
// Everything here is pure AST/text work over the TypeScript compiler API (the
// same parser the source-position mapper uses); no LSP types leak in, so the
// dispatcher can map the `SourceRange`/uri results onto `LocationLink`s.

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import ts from "typescript"
import type { SourceRange } from "../../synth/types.js"

/** Parse a `.tsx`/`.ts` buffer with parent pointers, tolerant of mid-edit JSX. */
export function parseSource(text: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

/** Line/character → absolute offset, or `undefined` when out of range. */
export function offsetAt(
  sf: ts.SourceFile,
  position: { line: number; character: number },
): number | undefined {
  try {
    return sf.getPositionOfLineAndCharacter(position.line, position.character)
  } catch {
    return undefined
  }
}

export function toRange(
  sf: ts.SourceFile,
  start: number,
  end: number,
): SourceRange {
  return {
    start: sf.getLineAndCharacterOfPosition(start),
    end: sf.getLineAndCharacterOfPosition(end),
  }
}

/** The deepest AST node whose span contains `offset` (half-open at the end). */
export function deepestNodeAt(sf: ts.SourceFile, offset: number): ts.Node {
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

/** Nearest ancestor (inclusive) matching `pred`. */
export function findAncestor<T extends ts.Node>(
  node: ts.Node,
  pred: (n: ts.Node) => n is T,
): T | undefined {
  let cur: ts.Node | undefined = node
  while (cur) {
    if (pred(cur)) return cur
    cur = cur.parent
  }
  return undefined
}

type OpeningTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement

export function isOpeningTag(node: ts.Node): node is OpeningTag {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
}

/** Render a JSX tag name, handling dot-notation (`Route.Branch`). */
export function tagText(tagName: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(tagName)) return tagName.text || undefined
  if (
    ts.isPropertyAccessExpression(tagName) &&
    ts.isIdentifier(tagName.expression)
  ) {
    return `${tagName.expression.text}.${tagName.name.text}`
  }
  return undefined
}

function attrName(name: ts.JsxAttributeName, sf: ts.SourceFile): string {
  return ts.isIdentifier(name) ? name.text : name.getText(sf)
}

/**
 * The opening element whose opening tag *starts* at `range.start`. The
 * source-position map points node ranges at the opening tag (`open.getStart()`),
 * so a `nodeId → Range` lookup can be turned back into the live AST element to
 * read its attributes (e.g. a source's `schema={…}` binding).
 */
export function elementAtRangeStart(
  sf: ts.SourceFile,
  range: SourceRange,
): OpeningTag | undefined {
  const start = offsetAt(sf, range.start)
  if (start === undefined) return undefined
  let found: OpeningTag | undefined
  const visit = (n: ts.Node): void => {
    if (found) return
    if (isOpeningTag(n) && n.getStart(sf) === start) {
      found = n
      return
    }
    n.forEachChild(visit)
  }
  sf.forEachChild(visit)
  return found
}

/** A JSX attribute's value when it is an identifier expression (`prop={ident}`
 *  or `prop={ident.member}`). `base` is the root identifier to resolve. */
export interface AttrIdentifier {
  readonly base: string
  /** Member access chain after the base (`["handle"]` for `iceberg.handle`). */
  readonly members: readonly string[]
  /** The value expression's range — used as the definition's origin span. */
  readonly valueRange: SourceRange
}

/**
 * Read a JSX attribute's value as an identifier reference. Returns `undefined`
 * for a missing attribute, a non-`{…}` value, or a computed expression (a call,
 * literal, etc.) — those are the "computed handle / inline" cases definition
 * deliberately cannot navigate.
 */
export function attrIdentifier(
  el: OpeningTag,
  prop: string,
  sf: ts.SourceFile,
): AttrIdentifier | undefined {
  for (const attribute of el.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    if (attrName(attribute.name, sf) !== prop) continue
    const init = attribute.initializer
    if (!init || !ts.isJsxExpression(init) || !init.expression) return undefined
    return identifierChain(init.expression, sf)
  }
  return undefined
}

function identifierChain(
  expr: ts.Expression,
  sf: ts.SourceFile,
): AttrIdentifier | undefined {
  const members: string[] = []
  let cur: ts.Expression = expr
  while (ts.isPropertyAccessExpression(cur)) {
    members.unshift(cur.name.text)
    cur = cur.expression
  }
  if (!ts.isIdentifier(cur)) return undefined
  return {
    base: cur.text,
    members,
    valueRange: toRange(sf, expr.getStart(sf), expr.getEnd()),
  }
}

/** Where a top-level binding name resolves to. */
export type BindingResolution =
  | {
      readonly kind: "local"
      /** The initializer expression (e.g. the `IcebergCatalog({…})` call or the
       *  `<KafkaSource/>` JSX) — its range is the definition target. */
      readonly init: ts.Expression
      readonly nameRange: SourceRange
    }
  | {
      readonly kind: "import"
      readonly moduleSpecifier: string
      /** The local binding name (alias-aware: `import { A as B }` → resolving
       *  `B` yields `importedName: "A"`). */
      readonly importedName: string
    }

/**
 * Resolve a top-level binding `name` in a source file to either its local
 * `const name = <init>` declaration or the `import` that brought it in. Only
 * module-scope `const`/`let`/`var` declarations and named imports are resolved
 * (function params, destructuring, and re-exports fall through to `undefined`).
 */
export function resolveBinding(
  sf: ts.SourceFile,
  name: string,
): BindingResolution | undefined {
  for (const stmt of sf.statements) {
    // const name = <init>
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === name &&
          decl.initializer
        ) {
          return {
            kind: "local",
            init: decl.initializer,
            nameRange: toRange(sf, decl.name.getStart(sf), decl.name.getEnd()),
          }
        }
      }
    }
    // import { name } from "spec"  /  import { orig as name } from "spec"
    if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings) {
      const bindings = stmt.importClause.namedBindings
      if (ts.isNamedImports(bindings)) {
        for (const spec of bindings.elements) {
          if (spec.name.text !== name) continue
          const importedName = spec.propertyName?.text ?? spec.name.text
          const moduleSpecifier = ts.isStringLiteral(stmt.moduleSpecifier)
            ? stmt.moduleSpecifier.text
            : undefined
          if (!moduleSpecifier) return undefined
          return { kind: "import", moduleSpecifier, importedName }
        }
      }
    }
  }
  return undefined
}

/**
 * Resolve a module specifier to an absolute file path. Handles relative
 * specifiers and the `@/` project alias (the convention `@flink-reactor` projects
 * use, mapping to the project root and `src/`). Bare specifiers (the DSL package
 * itself) are not resolved. Tries `.ts`, `.tsx`, and `/index.ts`.
 */
export function resolveModulePath(
  specifier: string,
  fromFile: string,
  projectDir: string,
): string | undefined {
  const bases: string[] = []
  if (specifier.startsWith(".")) {
    bases.push(resolve(dirname(fromFile), specifier))
  } else if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2)
    bases.push(join(projectDir, rest), join(projectDir, "src", rest))
  } else {
    return undefined // bare module (node_modules) — not a project file
  }
  for (const base of bases) {
    for (const candidate of [
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx"),
    ]) {
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

/** A located `Schema({ fields })` declaration. */
export interface SchemaDecl {
  /** Field name → the range of its *key* in the `fields` object literal. */
  readonly fields: ReadonlyMap<string, SourceRange>
  /** The binding name's range — a coarse fallback target when a specific field
   *  is not requested (e.g. revealing the schema declaration as a whole). */
  readonly declRange: SourceRange
}

/**
 * Find the `Schema({ fields: { … } })` call bound to `bindingName` in a module
 * (handles `const`/`export const`) and record each field key's source range.
 * Returns `undefined` when no such `Schema(...)`-initialized binding exists.
 */
export function findSchemaDecl(
  sf: ts.SourceFile,
  bindingName: string,
): SchemaDecl | undefined {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== bindingName)
        continue
      const init = decl.initializer
      if (!init || !ts.isCallExpression(init)) continue
      if (calleeName(init.expression) !== "Schema") continue
      const fields = schemaFieldRanges(init, sf)
      return {
        fields,
        declRange: toRange(sf, decl.name.getStart(sf), decl.name.getEnd()),
      }
    }
  }
  return undefined
}

/** Extract `Schema({ fields: { key: … } })` field-key ranges from the call. */
function schemaFieldRanges(
  call: ts.CallExpression,
  sf: ts.SourceFile,
): Map<string, SourceRange> {
  const ranges = new Map<string, SourceRange>()
  const options = call.arguments[0]
  if (!options || !ts.isObjectLiteralExpression(options)) return ranges
  for (const prop of options.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (propertyKeyText(prop.name) !== "fields") continue
    if (!ts.isObjectLiteralExpression(prop.initializer)) continue
    for (const field of prop.initializer.properties) {
      const key = fieldKeyName(field)
      if (!key) continue
      const keyNode = ts.isPropertyAssignment(field)
        ? field.name
        : ts.isShorthandPropertyAssignment(field)
          ? field.name
          : undefined
      if (!keyNode) continue
      ranges.set(key, toRange(sf, keyNode.getStart(sf), keyNode.getEnd()))
    }
  }
  return ranges
}

function fieldKeyName(prop: ts.ObjectLiteralElementLike): string | undefined {
  if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
    return propertyKeyText(prop.name)
  }
  return undefined
}

function propertyKeyText(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  )
    return name.text
  return undefined
}

/** The dotted/identifier name of a call's callee (`Schema`, `Field.DECIMAL`). */
function calleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text
  }
  return undefined
}

/**
 * Find the project root for a pipeline file: nearest ancestor with a
 * `flink-reactor.config.ts`, else nearest with a `tsconfig.json`/`package.json`,
 * else the file's own directory. Mirrors the server's `findProjectRoot` so
 * `@/`-alias resolution lands on the same root synthesis used.
 */
export function findProjectRoot(filePath: string): string {
  let dir = dirname(filePath)
  let fallback: string | undefined
  for (let i = 0; i < 50; i++) {
    if (existsSync(join(dir, "flink-reactor.config.ts"))) return dir
    if (
      !fallback &&
      (existsSync(join(dir, "tsconfig.json")) ||
        existsSync(join(dir, "package.json")))
    ) {
      fallback = dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return fallback ?? dirname(filePath)
}

/** Read a module file, returning `undefined` on any IO error. */
export function readModule(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}
