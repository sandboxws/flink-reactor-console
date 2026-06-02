/**
 * Build-time prop-metadata projection.
 *
 * Reads the DSL's emitted declaration files (`dist/browser.d.ts` and its
 * referenced `.d.ts`) with the TypeScript compiler and projects every
 * `${Component}Props` interface into a plain, serializable table: per prop, its
 * name, required/optional marker, a human-readable type string, the literal
 * members when the (alias-resolved) type is a string-literal union, and the
 * JSDoc summary. The result is written to
 * `src/providers/completion/prop-metadata.generated.ts`, which the
 * connector-property and enum-value completion providers read directly.
 *
 * Why build-time and not runtime: TypeScript string-literal-union types
 * (`KafkaFormat`, `KafkaStartupMode`, …) are erased at runtime, so the only way
 * to enumerate a prop's allowed values is to read the *types*. Doing that per
 * request in the server would be slow; baking a deterministic projection keeps
 * the server cheap. A parity test (no drift vs the component inventory) guards
 * the table — regenerate with `pnpm --filter @flink-reactor/language-server gen:prop-metadata`.
 */
import { writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DSL_COMPONENTS,
  HIERARCHY_ONLY_COMPONENTS,
} from "@flink-reactor/ts-plugin/rules"
import ts from "typescript"

interface PropMeta {
  readonly name: string
  readonly required: boolean
  readonly type: string
  readonly enumValues?: readonly string[]
  readonly doc?: string
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
const dslEntry = join(repoRoot, "dist", "browser.d.ts")
const outFile = join(
  here,
  "..",
  "src",
  "providers",
  "completion",
  "prop-metadata.generated.ts",
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

/** Structural props that are never offered as attribute completions. */
const SKIP_PROPS = new Set(["children"])

function componentNameFor(interfaceName: string): string {
  const stripped = interfaceName.replace(/Props$/, "")
  return NAME_OVERRIDES[stripped] ?? stripped
}

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

function docFor(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): string | undefined {
  const parts = symbol.getDocumentationComment(checker)
  const text = ts.displayPartsToString(parts).trim()
  return text.length > 0 ? text : undefined
}

function projectInterface(type: ts.Type, checker: ts.TypeChecker): PropMeta[] {
  const props: PropMeta[] = []
  for (const sym of type.getProperties()) {
    const name = sym.getName()
    if (SKIP_PROPS.has(name)) continue
    const decl = sym.valueDeclaration ?? sym.declarations?.[0]
    if (!decl) continue
    const required = !(sym.getFlags() & ts.SymbolFlags.Optional)
    // Optionality is already carried by `required`; drop the `| undefined`
    // strictNullChecks adds so the displayed type reads cleanly.
    const propType = checker.getNonNullableType(
      checker.getTypeOfSymbolAtLocation(sym, decl),
    )
    const enumValues = stringLiteralMembers(propType)
    // Prefer the alias name (`KafkaFormat`) over the expanded union for a tidy
    // detail string; the literal values travel separately in `enumValues`.
    const type =
      propType.aliasSymbol?.getName() ?? checker.typeToString(propType)
    const doc = docFor(sym, checker)
    props.push({
      name,
      required,
      type,
      ...(enumValues ? { enumValues } : {}),
      ...(doc ? { doc } : {}),
    })
  }
  // Deterministic order: required first, then alphabetical by name.
  props.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return props
}

function main(): void {
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

  const table: Record<string, readonly PropMeta[]> = {}
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    if (!exp.getName().endsWith("Props")) continue
    const sym =
      exp.getFlags() & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exp)
        : exp
    const component = componentNameFor(exp.getName())
    if (!KNOWN_COMPONENTS.has(component)) continue // drop non-component *Props
    const declaredType = checker.getDeclaredTypeOfSymbol(sym)
    const props = projectInterface(declaredType, checker)
    if (props.length > 0) table[component] = props
  }

  const sortedKeys = Object.keys(table).sort()
  const body = sortedKeys
    .map((component) => {
      const items = (table[component] as PropMeta[])
        .map((p) => `    ${JSON.stringify(p)},`)
        .join("\n")
      return `  ${JSON.stringify(component)}: [\n${items}\n  ],`
    })
    .join("\n")

  const out = `// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Build-time projection of the DSL's typed component prop interfaces, produced
// by \`scripts/generate-prop-metadata.ts\`. Connector-property and enum-value
// completions read this table so they never drift from the DSL types. A parity
// test guards coverage against the component inventory.
//
// Regenerate: pnpm --filter @flink-reactor/language-server gen:prop-metadata

/** A single projected component prop. */
export interface PropMeta {
  /** Prop (attribute) name. */
  readonly name: string
  /** True when the prop interface declares it without \`?\`. */
  readonly required: boolean
  /** Human-readable type string (from the TypeScript checker). */
  readonly type: string
  /** Present iff the (alias-resolved) type is a union of string literals. */
  readonly enumValues?: readonly string[]
  /** JSDoc summary, when the interface documents the prop. */
  readonly doc?: string
}

/** component name → its props (required first, then alphabetical). */
export const PROP_METADATA: Record<string, readonly PropMeta[]> = {
${body}
}
`

  writeFileSync(outFile, out, "utf8")
  const propCount = sortedKeys.reduce((n, k) => n + table[k].length, 0)
  console.log(
    `Wrote ${sortedKeys.length} components / ${propCount} props to ${outFile}`,
  )
}

main()
