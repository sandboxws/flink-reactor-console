// Refactor: extract an inline `Schema({...})` into `schemas/<name>.ts`
// (component-refactoring, Tier-3 feature 14).
//
// The conventional home for a schema is a `schemas/<name>.ts` module exporting
// a named `Schema(...)` const (the layout `create-fr-app` scaffolds and the
// cross-file definition resolver already follows). The refactor lifts an
// inline `schema={Schema({...})}` literal into that convention as ONE
// multi-file `WorkspaceEdit` — a `CreateFile` + content insert for the new
// module, an import added to the pipeline, and the inline literal replaced by
// the imported identifier — so the editor applies and undoes it as a unit.
//
// Naming derives from the consuming element's evident identity (`name`,
// `topic`, `table`, `connector` — the same precedence the DSL's name hints
// use), Pascal-cased with a `Schema` suffix; collisions against existing
// `schemas/*.ts` disambiguate with a numeric suffix — never an overwrite.

import { existsSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"
import {
  CodeAction,
  CodeActionKind,
  type CreateFile,
  type TextDocumentEdit,
} from "vscode-languageserver"
import {
  findAncestor,
  findProjectRoot,
  isOpeningTag,
  offsetAt,
  parseSource,
} from "../providers/definition/binding.js"
import { uriToFilePath } from "./schema-decl.js"
import type { RefactorInput } from "./schema-rename.js"

/**
 * Offer the extract-schema refactor when `range` touches an inline
 * `Schema({...})` passed to a `schema` prop. Pure AST + filesystem-existence
 * work — no synthesis state needed.
 */
export function buildExtractSchemaActions(
  input: Pick<RefactorInput, "sourceText" | "uri" | "position">,
): CodeAction[] {
  const filePath = uriToFilePath(input.uri)
  if (!filePath) return []
  const sf = parseSource(input.sourceText, filePath)
  const offset = offsetAt(sf, input.position)
  if (offset === undefined) return []

  const call = inlineSchemaCallAt(sf, offset)
  if (!call) return []
  const el = findAncestor(call, isOpeningTag)
  if (!el) return []

  const projectDir = findProjectRoot(filePath)
  const schemasDir = join(projectDir, "schemas")
  const hint = namingHint(el, sf)
  const { fileBase, exportName } = uniqueNames(schemasDir, hint)

  const modulePath = join(schemasDir, `${fileBase}.ts`)
  const moduleUri = pathToFileURL(modulePath).href
  const callText = call.getText(sf)
  const dslImports = dslIdentifiersUsed(call, sf)
  const importLine =
    dslImports.length > 0
      ? `import { ${dslImports.join(", ")} } from "@flink-reactor/dsl"\n\n`
      : ""
  const moduleContent = `${importLine}export const ${exportName} = ${callText}\n`

  // Pipeline-side edits: import the new module, swap the literal for the name.
  const importSpecifier = relativeImport(filePath, modulePath)
  const importInsertAt = afterLastImport(sf)
  const createFile: CreateFile = {
    kind: "create",
    uri: moduleUri,
    options: { ignoreIfExists: false, overwrite: false },
  }
  const moduleEdit: TextDocumentEdit = {
    textDocument: { uri: moduleUri, version: null },
    edits: [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        newText: moduleContent,
      },
    ],
  }
  const pipelineEdit: TextDocumentEdit = {
    textDocument: { uri: input.uri, version: null },
    edits: [
      {
        range: {
          start: sf.getLineAndCharacterOfPosition(importInsertAt),
          end: sf.getLineAndCharacterOfPosition(importInsertAt),
        },
        newText: `import { ${exportName} } from "${importSpecifier}"\n`,
      },
      {
        range: {
          start: sf.getLineAndCharacterOfPosition(call.getStart(sf)),
          end: sf.getLineAndCharacterOfPosition(call.getEnd()),
        },
        newText: exportName,
      },
    ],
  }

  const action = CodeAction.create(
    `Extract schema to schemas/${fileBase}.ts`,
    CodeActionKind.RefactorExtract,
  )
  action.edit = { documentChanges: [createFile, moduleEdit, pipelineEdit] }
  return [action]
}

/** The inline `Schema({...})` call at `offset`, but only when it is the direct
 *  value of a `schema={…}` JSX attribute (the refactor's precondition). */
function inlineSchemaCallAt(
  sf: ts.SourceFile,
  offset: number,
): ts.CallExpression | undefined {
  let hit: ts.CallExpression | undefined
  const visit = (node: ts.Node): void => {
    if (offset < node.getStart(sf) || offset >= node.getEnd()) return
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Schema"
    ) {
      const jsxExpr = node.parent
      const attr = jsxExpr?.parent
      if (
        jsxExpr &&
        ts.isJsxExpression(jsxExpr) &&
        attr &&
        ts.isJsxAttribute(attr) &&
        attr.name.getText(sf) === "schema"
      ) {
        hit = node
      }
    }
    node.forEachChild(visit)
  }
  sf.forEachChild(visit)
  return hit
}

/** Naming hint from the consuming element: `name` > `topic` > `table` >
 *  `connector`, else the lower-cased tag name. */
function namingHint(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
): string {
  const byName = new Map<string, string>()
  for (const prop of el.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue
    const init = prop.initializer
    if (init && ts.isStringLiteral(init)) {
      byName.set(prop.name.getText(sf), init.text)
    }
  }
  return (
    byName.get("name") ??
    byName.get("topic") ??
    byName.get("table") ??
    byName.get("connector") ??
    el.tagName.getText(sf).toLowerCase()
  )
}

/** Sanitize a hint into a kebab file base + Pascal `…Schema` export name,
 *  suffixing numerically on collision with an existing `schemas/*.ts`. */
function uniqueNames(
  schemasDir: string,
  hint: string,
): { fileBase: string; exportName: string } {
  const cleaned = hint
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  const base = cleaned.length > 0 ? cleaned : "schema"
  const pascal = base
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
  let fileBase = base
  let exportName = `${pascal}Schema`
  for (let n = 2; existsSync(join(schemasDir, `${fileBase}.ts`)); n++) {
    fileBase = `${base}-${n}`
    exportName = `${pascal}Schema${n}`
  }
  return { fileBase, exportName }
}

/** Identifiers inside the extracted call that the pipeline imports from the
 *  DSL (e.g. `Schema`, `Field`) — they become the new module's import list. */
function dslIdentifiersUsed(
  call: ts.CallExpression,
  sf: ts.SourceFile,
): string[] {
  const fromDsl = new Set<string>()
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue
    if (stmt.moduleSpecifier.text !== "@flink-reactor/dsl") continue
    const bindings = stmt.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const spec of bindings.elements) fromDsl.add(spec.name.text)
    }
  }
  const used = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && fromDsl.has(node.text)) {
      // Root identifiers only: `Field.BIGINT` adds `Field`, not `BIGINT`.
      const parent = node.parent
      const isMemberName =
        ts.isPropertyAccessExpression(parent) && parent.name === node
      if (!isMemberName) used.add(node.text)
    }
    node.forEachChild(visit)
  }
  visit(call)
  return [...used].sort()
}

/** The offset just past the last top-level import (start of the next line). */
function afterLastImport(sf: ts.SourceFile): number {
  let end = 0
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) end = stmt.getEnd()
  }
  if (end === 0) return 0
  const text = sf.getFullText()
  while (end < text.length && text[end] !== "\n") end++
  return Math.min(end + 1, text.length)
}

/** A `./`-anchored, extension-less relative import specifier. */
function relativeImport(fromFile: string, toModule: string): string {
  let spec = relative(dirname(fromFile), toModule).replace(/\\/g, "/")
  spec = spec.replace(/\.ts$/, "")
  if (!spec.startsWith(".")) spec = `./${spec}`
  return spec
}
