/**
 * Build-time prop-FORM schema projection (visual-designer, Tier-3 feature 15).
 *
 * Sibling of `generate-prop-metadata.ts`, but shaped for *rendering a form*
 * rather than serving completions: per component, every prop becomes a typed
 * form field — an input kind derived from the (alias-resolved) TypeScript type
 * (`string`/`number`/`boolean`/`enum`/`array`/`object`), enum options when the
 * type is a string-literal union (`KafkaFormat` → dropdown), a required marker
 * honoring BOTH interface optionality (`readonly x:` vs `readonly x?:`) AND
 * the component's runtime `requireProps(...)` list (read from the component
 * sources — it is erased from the `.d.ts`), the JSDoc summary as field help,
 * and a `readOnlyInForm` marker for prop types no form input can represent as
 * a literal (objects, generics like `SchemaDefinition<T>`, callbacks, mixed
 * unions) — those render read-only with an "Edit in source" affordance.
 *
 * The result is written to `src/designer/prop-form-schema.generated.ts` and
 * published as the `@flink-reactor/language-server/prop-form-schema` subpath —
 * a pure-data module with zero imports, safe to inline into the VS Code
 * extension host (which posts it to the designer webview as JSON).
 *
 * Regenerate: pnpm --filter @flink-reactor/language-server gen:prop-form-schema
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DSL_COMPONENTS,
  HIERARCHY_ONLY_COMPONENTS,
} from "@flink-reactor/ts-plugin/rules"
import ts from "typescript"

type PropInputKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "array"
  | "object"

interface PropFormField {
  readonly name: string
  readonly required: boolean
  readonly inputKind: PropInputKind
  readonly type: string
  readonly options?: readonly string[]
  readonly help?: string
  readonly readOnlyInForm: boolean
}

interface ComponentFormSchema {
  readonly component: string
  readonly runtimeRequired: readonly string[]
  readonly fields: readonly PropFormField[]
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
const dslEntry = join(repoRoot, "dist", "browser.d.ts")
const componentsDir = join(repoRoot, "src", "components")
const outFile = join(
  here,
  "..",
  "src",
  "designer",
  "prop-form-schema.generated.ts",
)

/** Known set of real components — interfaces projecting to anything else are dropped. */
const KNOWN_COMPONENTS = new Set<string>([
  ...DSL_COMPONENTS.keys(),
  ...HIERARCHY_ONLY_COMPONENTS,
])

/** `${Component}Props` whose stripped name does not equal the dotted component. */
const NAME_OVERRIDES: Record<string, string> = {
  RouteBranch: "Route.Branch",
  RouteDefault: "Route.Default",
  QuerySelect: "Query.Select",
  QueryWhere: "Query.Where",
  QueryGroupBy: "Query.GroupBy",
  QueryHaving: "Query.Having",
  QueryOrderBy: "Query.OrderBy",
  SideOutputSink: "SideOutput.Sink",
  ValidateReject: "Validate.Reject",
}

/** Structural props never offered as form fields. */
const SKIP_PROPS = new Set(["children"])

function componentNameFor(interfaceName: string): string {
  const stripped = interfaceName.replace(/Props$/, "")
  return NAME_OVERRIDES[stripped] ?? stripped
}

// ── requireProps(...) extraction (from the component SOURCES) ────────
//
// The runtime required list is invisible in the emitted `.d.ts` (it lives in
// the factory body), so it is read from `src/components/*.ts` directly:
// every `requireProps("Name", props, ["a", "b"])` call contributes its
// component → required-keys pairing.

function collectRuntimeRequired(): ReadonlyMap<string, readonly string[]> {
  const table = new Map<string, readonly string[]>()
  for (const file of readdirSync(componentsDir)) {
    if (!file.endsWith(".ts")) continue
    const text = readFileSync(join(componentsDir, file), "utf8")
    const sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ false,
      ts.ScriptKind.TS,
    )
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "requireProps" &&
        node.arguments.length >= 3
      ) {
        const [nameArg, , listArg] = node.arguments
        if (
          nameArg &&
          ts.isStringLiteral(nameArg) &&
          listArg &&
          ts.isArrayLiteralExpression(listArg)
        ) {
          const keys = listArg.elements
            .filter(ts.isStringLiteral)
            .map((e) => e.text)
          if (keys.length > 0) table.set(nameArg.text, keys)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return table
}

// ── Input-kind derivation ─────────────────────────────────────────────

function stringLiteralMembers(type: ts.Type): string[] | undefined {
  if (!type.isUnion()) {
    return type.isStringLiteral() ? [type.value] : undefined
  }
  const members = type.types.filter(
    (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
  )
  if (members.length === 0) return undefined
  if (!members.every((t) => t.isStringLiteral())) return undefined
  return members.map((t) => (t as ts.StringLiteralType).value)
}

/** True when every (non-nullish) union member satisfies `predicate`, or the
 *  type is not a union and satisfies it directly. */
function allMembers(
  type: ts.Type,
  predicate: (t: ts.Type) => boolean,
): boolean {
  if (!type.isUnion()) return predicate(type)
  const members = type.types.filter(
    (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
  )
  return members.length > 0 && members.every(predicate)
}

function deriveInputKind(
  type: ts.Type,
  checker: ts.TypeChecker,
): { inputKind: PropInputKind; options?: readonly string[] } {
  // String-literal union → enum dropdown (`KafkaFormat`, `KafkaStartupMode`).
  const options = stringLiteralMembers(type)
  if (options && options.length > 1) return { inputKind: "enum", options }

  // Callbacks can never be a form input.
  if (type.getCallSignatures().length > 0) return { inputKind: "object" }

  const isBoolean = (t: ts.Type) =>
    (t.flags & (ts.TypeFlags.BooleanLike | ts.TypeFlags.BooleanLiteral)) !== 0
  const isNumber = (t: ts.Type) =>
    (t.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.NumberLiteral)) !== 0
  const isString = (t: ts.Type) => (t.flags & ts.TypeFlags.StringLike) !== 0

  if (allMembers(type, isBoolean)) return { inputKind: "boolean" }
  if (allMembers(type, isNumber)) return { inputKind: "number" }
  if (allMembers(type, isString)) return { inputKind: "string" }

  // Arrays are editable only when their element type is itself literal-shaped
  // (`readonly string[]` primary keys, …); arrays of objects fall through.
  if (checker.isArrayLikeType(type)) {
    const element = type.getNumberIndexType()
    if (
      element &&
      (allMembers(element, isString) ||
        allMembers(element, isNumber) ||
        allMembers(element, isBoolean))
    ) {
      return { inputKind: "array" }
    }
    return { inputKind: "object" }
  }

  // Everything else — object shapes, generics (`SchemaDefinition<T>`),
  // construct-node references, mixed unions (`boolean | TapConfig`) — has no
  // literal form representation.
  return { inputKind: "object" }
}

function docFor(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): string | undefined {
  const parts = symbol.getDocumentationComment(checker)
  const text = ts.displayPartsToString(parts).trim()
  return text.length > 0 ? text : undefined
}

function projectInterface(
  type: ts.Type,
  checker: ts.TypeChecker,
  runtimeRequired: readonly string[],
): PropFormField[] {
  const fields: PropFormField[] = []
  for (const sym of type.getProperties()) {
    const name = sym.getName()
    if (SKIP_PROPS.has(name)) continue
    const decl = sym.valueDeclaration ?? sym.declarations?.[0]
    if (!decl) continue
    const declaredRequired = !(sym.getFlags() & ts.SymbolFlags.Optional)
    const required = declaredRequired || runtimeRequired.includes(name)
    const propType = checker.getNonNullableType(
      checker.getTypeOfSymbolAtLocation(sym, decl),
    )
    const { inputKind, options } = deriveInputKind(propType, checker)
    const typeText =
      propType.aliasSymbol?.getName() ?? checker.typeToString(propType)
    const help = docFor(sym, checker)
    fields.push({
      name,
      required,
      inputKind,
      type: typeText,
      ...(options ? { options } : {}),
      ...(help ? { help } : {}),
      readOnlyInForm: inputKind === "object",
    })
  }
  // Deterministic order: required first, then alphabetical by name.
  fields.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return fields
}

function main(): void {
  const runtimeRequiredTable = collectRuntimeRequired()
  const program = ts.createProgram([dslEntry], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    noEmit: true,
    strict: true,
  })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(dslEntry)
  if (!source) throw new Error(`Cannot load DSL declarations at ${dslEntry}`)
  const moduleSymbol = checker.getSymbolAtLocation(source)
  if (!moduleSymbol) throw new Error("DSL entry has no module symbol")

  const table: Record<string, ComponentFormSchema> = {}
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    if (!exp.getName().endsWith("Props")) continue
    const sym =
      exp.getFlags() & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exp)
        : exp
    const component = componentNameFor(exp.getName())
    if (!KNOWN_COMPONENTS.has(component)) continue // drop non-component *Props
    const declaredType = checker.getDeclaredTypeOfSymbol(sym)
    const runtimeRequired = runtimeRequiredTable.get(component) ?? []
    const fields = projectInterface(declaredType, checker, runtimeRequired)
    if (fields.length > 0) {
      table[component] = { component, runtimeRequired, fields }
    }
  }

  const sortedKeys = Object.keys(table).sort()
  const body = sortedKeys
    .map((component) => {
      const schema = table[component] as ComponentFormSchema
      const items = schema.fields
        .map((f) => `      ${JSON.stringify(f)},`)
        .join("\n")
      return [
        `  ${JSON.stringify(component)}: {`,
        `    component: ${JSON.stringify(schema.component)},`,
        `    runtimeRequired: ${JSON.stringify(schema.runtimeRequired)},`,
        "    fields: [",
        items,
        "    ],",
        "  },",
      ].join("\n")
    })
    .join("\n")

  const out = `// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Build-time prop-FORM schema projected from the DSL's typed component prop
// interfaces by \`scripts/generate-prop-form-schema.ts\` (visual-designer,
// Tier-3 feature 15). The designer webview renders prop forms from this table
// — string-literal unions as dropdowns, required markers honoring interface
// optionality AND \`requireProps(...)\`, JSDoc as field help — so the form can
// never drift from the DSL types. Pure data, zero imports: safe to inline
// into any bundle.
//
// Regenerate: pnpm --filter @flink-reactor/language-server gen:prop-form-schema

/** The form input a prop's TypeScript type reduces to. */
export type PropInputKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "array"
  | "object"

/** One prop projected as a form field. */
export interface PropFormField {
  /** Prop (attribute) name. */
  readonly name: string
  /** True when non-optional in the interface OR listed in \`requireProps(...)\`. */
  readonly required: boolean
  /** Input kind derived from the (alias-resolved) type. */
  readonly inputKind: PropInputKind
  /** Human-readable type string (alias name or checker output). */
  readonly type: string
  /** Present iff \`inputKind === "enum"\` — the string-literal union members. */
  readonly options?: readonly string[]
  /** JSDoc summary, rendered as inline field help. */
  readonly help?: string
  /** True when the type has no literal form representation (object/generic/
   *  callback) — the form renders it read-only with "Edit in source". */
  readonly readOnlyInForm: boolean
}

/** One component's complete prop-form schema. */
export interface ComponentFormSchema {
  readonly component: string
  /** Props the component's \`requireProps(...)\` call enforces at synthesis. */
  readonly runtimeRequired: readonly string[]
  /** Form fields: required first, then alphabetical. */
  readonly fields: readonly PropFormField[]
}

/** component name → its prop-form schema. */
export const PROP_FORM_SCHEMA: Record<string, ComponentFormSchema> = {
${body}
}
`

  writeFileSync(outFile, out, "utf8")
  const fieldCount = sortedKeys.reduce(
    (n, k) => n + (table[k]?.fields.length ?? 0),
    0,
  )
  console.log(
    `Wrote ${sortedKeys.length} components / ${fieldCount} form fields to ${outFile}`,
  )
}

main()
