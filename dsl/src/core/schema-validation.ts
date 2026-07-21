import {
  indexTree,
  type ResolvedColumn,
  resolveNodeSchema,
  resolveTransformSchema,
} from "@/codegen/schema-introspect.js"
import { validateSqlExpression } from "./sql-expr-validator.js"
import type {
  ValidationCategory,
  ValidationDiagnostic,
  ValidationDiagnosticDetails,
} from "./synth-context.js"
import type { ConstructNode } from "./types.js"

// ── SQL keywords to exclude from bare identifier matching ──────────

const SQL_KEYWORDS: ReadonlySet<string> = new Set([
  "AND",
  "OR",
  "NOT",
  "IS",
  "NULL",
  "TRUE",
  "FALSE",
  "IN",
  "BETWEEN",
  "LIKE",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "AS",
  "FROM",
  "WHERE",
  "SELECT",
  "GROUP",
  "BY",
  "ORDER",
  "ASC",
  "DESC",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "ON",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "UNION",
  "ALL",
  "DISTINCT",
  "EXISTS",
  "CAST",
  "TIMESTAMP",
  "DATE",
  "TIME",
  "INTERVAL",
  "ROW",
  "ARRAY",
  "MAP",
  "OVER",
  "PARTITION",
  "ROWS",
  "RANGE",
  "UNBOUNDED",
  "PRECEDING",
  "FOLLOWING",
  "CURRENT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "FIRST_VALUE",
  "LAST_VALUE",
  "LAG",
  "LEAD",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "COALESCE",
  "IF",
  "NULLIF",
  "IFNULL",
  "CONCAT",
  "SUBSTRING",
  "TRIM",
  "UPPER",
  "LOWER",
  "LENGTH",
  "REPLACE",
  "REGEXP",
  "FLOOR",
  "CEIL",
  "ROUND",
  "ABS",
  "MOD",
  "POWER",
  "SQRT",
  "LOG",
  "LN",
  "EXP",
  "CURRENT_TIMESTAMP",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "LOCALTIME",
  "LOCALTIMESTAMP",
  "NOW",
  "TO_TIMESTAMP",
  "TO_DATE",
  "DATE_FORMAT",
  "TIMESTAMPDIFF",
  "TIMESTAMPADD",
  "EXTRACT",
  "YEAR",
  "MONTH",
  "DAY",
  "HOUR",
  "MINUTE",
  "SECOND",
])

// ── Column reference extraction ─────────────────────────────────────

/**
 * Extract column references from a SQL expression.
 *
 * Strategy:
 * 1. Extract backtick-quoted identifiers (definitive column references)
 * 2. Match bare identifiers against the known column set (best-effort)
 * 3. Exclude SQL keywords and numeric/string literals
 *
 * Returns deduplicated list of referenced column names.
 */
export function extractColumnReferences(
  expr: string,
  knownColumns: string[],
): string[] {
  const refs = new Set<string>()

  // 1. Backtick-quoted identifiers: `column_name`
  const backtickPattern = /`([^`]+)`/g
  let match: RegExpExecArray | null
  while ((match = backtickPattern.exec(expr)) !== null) {
    refs.add(match[1])
  }

  // 2. Bare identifiers matched against known columns
  const knownSet = new Set(knownColumns)
  // Remove string literals and backtick-quoted sections to avoid false matches
  const cleaned = expr
    .replace(/`[^`]+`/g, "") // remove backtick-quoted
    .replace(/'[^']*'/g, "") // remove string literals
  const barePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
  while ((match = barePattern.exec(cleaned)) !== null) {
    const ident = match[1]
    // Skip SQL keywords (case-insensitive)
    if (SQL_KEYWORDS.has(ident.toUpperCase())) continue
    // Only include if it's a known column
    if (knownSet.has(ident)) {
      refs.add(ident)
    }
  }

  return [...refs]
}

// ── Schema validation ───────────────────────────────────────────────

/**
 * Validate column references in transform props against resolved upstream schemas.
 *
 * Handles two construct tree patterns:
 *
 * 1. **Nesting pattern**: `<Source><Filter><Sink/></Filter></Source>`
 *    Parent is upstream of children. Schema propagates from parent → child.
 *
 * 2. **Sibling pattern**: `<Pipeline><Source/><Filter/><Sink/></Pipeline>`
 *    Preceding siblings are upstream. Schema propagates left → right.
 */
export function validateSchemaReferences(
  pipelineNode: ConstructNode,
): ValidationDiagnostic[] {
  const nodeIndex = new Map<string, ConstructNode>()
  indexTree(pipelineNode, nodeIndex)

  const diagnostics: ValidationDiagnostic[] = []

  /**
   * Walk the tree with a propagated schema context.
   * `inheritedSchema` is the schema from the upstream context (parent or preceding sibling).
   */
  function walk(
    node: ConstructNode,
    inheritedSchema: ResolvedColumn[] | null,
  ): void {
    let currentSchema = inheritedSchema

    // If this node is a Source, resolve its own schema
    if (node.kind === "Source") {
      currentSchema = resolveNodeSchema(node, nodeIndex)
    }

    // If this node is a Transform or Join, validate its column references
    if (node.kind === "Transform" || node.kind === "Join") {
      // Explicit children are an authoritative upstream declaration — prefer
      // them over an inherited schema from an enclosing context. Example:
      // `Aggregate({ children: windowed })` nested inside a LookupJoin's
      // subtree must validate `groupBy`/`select` against `windowed`'s output,
      // not the Join's inherited schema (which would be the *other* join
      // input). We resolve child[0]'s OUTPUT, which is this node's INPUT —
      // resolving the node itself would yield the transform's output and
      // miss columns the node's expressions reference upstream.
      if (node.children.length > 0) {
        const upstreamSchema = resolveNodeSchema(node.children[0], nodeIndex)
        if (upstreamSchema !== null) currentSchema = upstreamSchema
      }
      // Fall back to resolveNodeSchema when nothing is inherited (e.g. the
      // Sink → Filter → Source reverse-nesting pattern with no parent).
      if (currentSchema === null) {
        currentSchema = resolveNodeSchema(node, nodeIndex)
      }
      // For Joins, also try resolving from children (join inputs)
      if (
        node.kind === "Join" &&
        currentSchema === null &&
        node.children.length > 0
      ) {
        const childSchemas = node.children
          .map((c) => resolveNodeSchema(c, nodeIndex))
          .filter((s): s is ResolvedColumn[] => s !== null)
        if (childSchemas.length > 0) {
          currentSchema = childSchemas.flat()
        }
      }

      if (currentSchema === null) {
        diagnostics.push({
          severity: "warning",
          message: `Cannot resolve upstream schema for '${node.component}' (${node.id}) — skipping column reference validation`,
          nodeId: node.id,
          component: node.component,
          category: "schema",
        })
      } else {
        const columnNames = currentSchema.map((c) => c.name)
        diagnostics.push(...validateNodeColumnReferences(node, columnNames))
      }
      // Propagate schema through this transform for downstream children
      if (currentSchema) {
        currentSchema = resolveTransformSchema(node, currentSchema)
      }
    }

    // Process children — handle sibling chain propagation
    // Children are processed left-to-right; each sibling inherits the schema
    // from the previous sibling (sibling pattern) or from the parent (nesting pattern).
    let siblingSchema = currentSchema
    for (const child of node.children) {
      walk(child, siblingSchema)
      // After walking a Source or RawSQL child, update sibling schema for
      // next siblings — both contribute their own declared output schema.
      if (child.kind === "Source" || child.kind === "RawSQL") {
        siblingSchema = resolveNodeSchema(child, nodeIndex)
      } else if (child.kind === "Transform" && siblingSchema) {
        siblingSchema = resolveTransformSchema(child, siblingSchema)
      } else if (child.kind === "Join") {
        // A join emits its combined output — the driving input plus the
        // enriched/right-hand columns (e.g. a LookupJoin's dimension
        // columns). Propagate that so downstream siblings validate against
        // the joined schema, not just the pre-join input.
        const joined = resolveNodeSchema(child, nodeIndex)
        if (joined !== null) siblingSchema = joined
      }
    }
  }

  walk(pipelineNode, null)
  return diagnostics
}

// ── Per-component column validation ─────────────────────────────────

function validateNodeColumnReferences(
  node: ConstructNode,
  availableColumns: string[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = []
  const colSet = new Set(availableColumns)

  const makeDiag = (
    severity: "error" | "warning",
    referencedColumn: string,
    context: string,
  ): ValidationDiagnostic => ({
    severity,
    message: `${node.component} '${node.id}' references unknown column '${referencedColumn}' in ${context}. Available columns: [${availableColumns.join(", ")}]`,
    nodeId: node.id,
    component: node.component,
    category: "schema" as ValidationCategory,
    details: {
      availableColumns,
      referencedColumn,
    },
  })

  switch (node.component) {
    // ── Array-lookup components ──────────────────────────────────
    case "Deduplicate": {
      const key = node.props.key as readonly string[] | undefined
      const order = node.props.order as string | undefined
      if (key) {
        for (const col of key) {
          if (!colSet.has(col)) diagnostics.push(makeDiag("error", col, "key"))
        }
      }
      if (order) {
        // order is a single column name, optionally with ASC/DESC suffix
        const colName = order.replace(/\s+(ASC|DESC)$/i, "").trim()
        if (!colSet.has(colName))
          diagnostics.push(makeDiag("error", colName, "order"))
      }
      break
    }

    case "TopN": {
      const partitionBy = node.props.partitionBy as
        | readonly string[]
        | undefined
      const orderBy = node.props.orderBy as
        | Record<string, "ASC" | "DESC">
        | undefined
      if (partitionBy) {
        for (const col of partitionBy) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "partitionBy"))
        }
      }
      if (orderBy) {
        for (const col of Object.keys(orderBy)) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "orderBy"))
        }
      }
      break
    }

    case "Drop": {
      const columns = node.props.columns as readonly string[] | undefined
      if (columns) {
        for (const col of columns) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "columns"))
        }
      }
      break
    }

    case "Rename": {
      const columns = node.props.columns as Record<string, string> | undefined
      if (columns) {
        for (const oldName of Object.keys(columns)) {
          if (!colSet.has(oldName))
            diagnostics.push(makeDiag("error", oldName, "columns"))
        }
      }
      break
    }

    case "Cast": {
      const columns = node.props.columns as Record<string, string> | undefined
      if (columns) {
        for (const col of Object.keys(columns)) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "columns"))
        }
      }
      break
    }

    case "Coalesce": {
      const columns = node.props.columns as Record<string, string> | undefined
      if (columns) {
        for (const col of Object.keys(columns)) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "columns"))
        }
      }
      break
    }

    // ── Expression-extraction components ─────────────────────────
    case "Filter": {
      const condition = node.props.condition as string | undefined
      if (condition) {
        const refs = extractColumnReferences(condition, availableColumns)
        for (const ref of refs) {
          if (!colSet.has(ref))
            diagnostics.push(makeDiag("error", ref, "condition"))
        }
      }
      break
    }

    case "Map": {
      const select = node.props.select as Record<string, string> | undefined
      if (select) {
        for (const [alias, expr] of Object.entries(select)) {
          const refs = extractColumnReferences(expr, availableColumns)
          for (const ref of refs) {
            if (!colSet.has(ref))
              diagnostics.push(makeDiag("error", ref, `select.${alias}`))
          }
        }
      }
      break
    }

    case "Aggregate": {
      const groupBy = node.props.groupBy as readonly string[] | undefined
      const select = node.props.select as Record<string, string> | undefined
      if (groupBy) {
        for (const col of groupBy) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "groupBy"))
        }
      }
      if (select) {
        for (const [alias, expr] of Object.entries(select)) {
          const refs = extractColumnReferences(expr, availableColumns)
          for (const ref of refs) {
            if (!colSet.has(ref))
              diagnostics.push(makeDiag("error", ref, `select.${alias}`))
          }
        }
      }
      break
    }

    case "Join": {
      const on = node.props.on as string | undefined
      if (on) {
        const refs = extractColumnReferences(on, availableColumns)
        for (const ref of refs) {
          if (!colSet.has(ref)) diagnostics.push(makeDiag("error", ref, "on"))
        }
      }
      break
    }

    case "Validate": {
      const rules = node.props.rules as
        | { notNull?: readonly string[]; range?: Record<string, unknown> }
        | undefined
      if (rules?.notNull) {
        for (const col of rules.notNull) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "rules.notNull"))
        }
      }
      if (rules?.range) {
        for (const col of Object.keys(rules.range)) {
          if (!colSet.has(col))
            diagnostics.push(makeDiag("error", col, "rules.range"))
        }
      }
      break
    }
  }

  return diagnostics
}

// ── Expression syntax validation ─────────────────────────────────────

/**
 * Expression-type props by component, the single source of truth for *where*
 * a component's props carry SQL expressions or column references. Shared by the
 * syntax validator (`validateExpressionSyntax`) and by source-text consumers
 * (the language server's hover + column-completion providers) — a prop added
 * here is honored everywhere.
 *
 * Each entry is a path into the node's props, with a terminal modifier that
 * declares the value shape:
 *   - `prop`        a `string` SQL expression (column refs author-quoted)
 *   - `prop.*`      a `Record<string,string>` whose *values* are SQL expressions
 *   - `prop[]`      a `string[]` whose elements are column names (codegen-quoted)
 *   - `prop{}`      a `Record` whose *keys* are column names (codegen-quoted)
 *   - `prop#`       a `string` holding a single column name (codegen-quoted)
 *   - segments join with `.` for nested shapes (e.g. `rules.expression.*`)
 *
 * The `.*`/(plain) shapes are verbatim SQL; the `[]`/`{}`/`#` shapes are bare
 * column names the codegen back-quotes via `quoteIdentifier`. Completion uses
 * that distinction to decide whether to insert a back-quoted identifier.
 */
export const EXPRESSION_PROPS: Record<string, string[]> = {
  Filter: ["condition"],
  Map: ["select.*"],
  Aggregate: ["groupBy[]", "select.*"],
  Join: ["on"],
  TemporalJoin: ["on"],
  IntervalJoin: ["on"],
  LookupJoin: ["on"],
  Deduplicate: ["key[]", "order#"],
  TopN: ["partitionBy[]", "orderBy{}"],
  Validate: ["rules.notNull[]", "rules.range{}", "rules.expression.*"],
  Qualify: ["condition"],
  "Query.Select": ["columns.*"],
  "Query.Where": ["condition"],
  "Query.Having": ["condition"],
  "Query.OrderBy": ["columns{}"],
}

/** A path segment's base name and terminal value-shape modifier. */
function parseSegment(seg: string): {
  base: string
  suffix: "" | "[]" | "{}" | "#"
} {
  if (seg.endsWith("[]")) return { base: seg.slice(0, -2), suffix: "[]" }
  if (seg.endsWith("{}")) return { base: seg.slice(0, -2), suffix: "{}" }
  if (seg.endsWith("#")) return { base: seg.slice(0, -1), suffix: "#" }
  return { base: seg, suffix: "" }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Walk one EXPRESSION_PROPS path into `value`, pushing each extracted string. */
function collectExpressions(
  value: unknown,
  segments: readonly string[],
  prefix: string,
  out: Array<{ propPath: string; expr: string }>,
): void {
  if (segments.length === 0) {
    if (typeof value === "string") out.push({ propPath: prefix, expr: value })
    return
  }
  const [seg, ...rest] = segments
  if (seg === "*") {
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        collectExpressions(child, rest, prefix ? `${prefix}.${key}` : key, out)
      }
    }
    return
  }
  const { base, suffix } = parseSegment(seg)
  const child = isPlainObject(value) ? value[base] : undefined
  const childPath = prefix ? `${prefix}.${base}` : base
  // The `[]`/`{}`/`#` shapes hold bare column *names*, not SQL expressions: a
  // lone identifier is always valid syntax, so feeding it to the SQL parser is
  // pointless (and risks mis-parsing a keyword-like column). Their existence is
  // checked by `validateSchemaReferences`; completion reads them from the table
  // directly. So syntax extraction only descends into verbatim-SQL shapes.
  if (suffix === "[]" || suffix === "{}" || suffix === "#") return
  collectExpressions(child, rest, childPath, out)
}

/**
 * Extract the verbatim SQL-expression strings from a node per EXPRESSION_PROPS
 * (the `prop` and `prop.*` shapes). Bare column-name shapes are skipped — see
 * `collectExpressions`. Returns array of `{ propPath, expr }`.
 */
function extractExpressions(
  node: ConstructNode,
): Array<{ propPath: string; expr: string }> {
  const propPaths = EXPRESSION_PROPS[node.component]
  if (!propPaths) return []

  const result: Array<{ propPath: string; expr: string }> = []
  for (const path of propPaths) {
    collectExpressions(node.props, path.split("."), "", result)
  }
  return result
}

/**
 * Validate SQL expression syntax for all expression-type props in a pipeline.
 *
 * Walks the construct tree, finds components with expression props
 * (Filter.condition, Map.select values, Join.on, etc.), and validates
 * each expression using dt-sql-parser's FlinkSQL parser.
 *
 * Returns diagnostics with category "expression" and details.expressionErrors.
 */
export async function validateExpressionSyntax(
  pipelineNode: ConstructNode,
): Promise<ValidationDiagnostic[]> {
  const diagnostics: ValidationDiagnostic[] = []
  const nodes: ConstructNode[] = []

  // Collect all nodes
  function collect(node: ConstructNode): void {
    nodes.push(node)
    for (const child of node.children) {
      collect(child)
    }
  }
  collect(pipelineNode)

  // Validate expressions in each node
  for (const node of nodes) {
    const expressions = extractExpressions(node)
    for (const { propPath, expr } of expressions) {
      const result = await validateSqlExpression(expr)
      if (!result.valid) {
        const expressionErrors = result.errors.map(
          (e) => `col ${e.startColumn}: ${e.message}`,
        )
        diagnostics.push({
          severity: "warning",
          message: `${node.component} '${node.id}' has invalid SQL syntax in ${propPath}: ${expressionErrors.join("; ")}`,
          nodeId: node.id,
          component: node.component,
          category: "expression" as ValidationCategory,
          details: {
            expressionErrors,
          } as ValidationDiagnosticDetails,
        })
      }
    }
  }

  return diagnostics
}
