import { FlinkVersionCompat } from "@/core/flink-compat.js"
import type { ConstructNode } from "@/core/types.js"
import type { BuildContext } from "./sql-build-context.js"
import { quoteIdentifier as q, quoteStringLiteral } from "./sql-identifiers.js"

/**
 * Changelog process-table-function builders (Flink 2.3+, FLIP-564).
 *
 * Both PTFs take named arguments — `input => TABLE (<subquery>)`,
 * `op => DESCRIPTOR(col)`, `op_mapping => MAP[...]` — so they live as query
 * builders rather than source/sink emitters. The `input` node is the first
 * child of the construct (set by the `FromChangelog`/`ToChangelog` factories).
 *
 * `op_mapping` is a `MAP<STRING, STRING>` literal; the entry *direction*
 * differs by function and is supplied by the caller's mapping object:
 *   - FROM_CHANGELOG maps raw code → Flink operation name.
 *   - TO_CHANGELOG maps Flink operation name → raw code.
 */

function requireChangelogFeature(ctx: BuildContext): void {
  const check = FlinkVersionCompat.checkFeature(
    "FROM_TO_CHANGELOG",
    ctx.version,
  )
  if (check) {
    throw new Error(check.message)
  }
}

function inputTableArg(ctx: BuildContext, node: ConstructNode): string {
  const upstream =
    node.children.length > 0
      ? ctx.buildQuery(ctx, node.children[0])
      : "SELECT * FROM unknown"
  const partitionBy = node.props.partitionBy as readonly string[] | undefined
  const partition =
    partitionBy && partitionBy.length > 0
      ? ` PARTITION BY ${partitionBy.map(q).join(", ")}`
      : ""
  return `TABLE (\n${upstream}\n)${partition}`
}

/** Render a `MAP['k1', 'v1', 'k2', 'v2', …]` string-keyed map literal. */
function sqlStringMap(pairs: ReadonlyArray<readonly [string, string]>): string {
  const inner = pairs
    .map(([k, v]) => `${quoteStringLiteral(k)}, ${quoteStringLiteral(v)}`)
    .join(", ")
  return `MAP[${inner}]`
}

function opMappingArg(node: ConstructNode): string | undefined {
  const opMapping = node.props.opMapping as Record<string, string> | undefined
  if (!opMapping || Object.keys(opMapping).length === 0) {
    return undefined
  }
  return `op_mapping => ${sqlStringMap(Object.entries(opMapping))}`
}

export function buildFromChangelogQuery(
  ctx: BuildContext,
  node: ConstructNode,
): string {
  requireChangelogFeature(ctx)

  const args: string[] = [`input => ${inputTableArg(ctx, node)}`]

  const opColumn = node.props.opColumn as string | undefined
  if (opColumn) {
    args.push(`op => DESCRIPTOR(${q(opColumn)})`)
  }

  const mapping = opMappingArg(node)
  if (mapping) {
    args.push(mapping)
  }

  const errorHandling = node.props.errorHandling as string | undefined
  if (errorHandling) {
    args.push(`error_handling => ${quoteStringLiteral(errorHandling)}`)
  }

  return `SELECT * FROM FROM_CHANGELOG(\n  ${args.join(",\n  ")}\n)`
}

export function buildToChangelogQuery(
  ctx: BuildContext,
  node: ConstructNode,
): string {
  requireChangelogFeature(ctx)

  const args: string[] = [`input => ${inputTableArg(ctx, node)}`]

  const opColumn = node.props.opColumn as string | undefined
  if (opColumn) {
    args.push(`op => DESCRIPTOR(${q(opColumn)})`)
  }

  const mapping = opMappingArg(node)
  if (mapping) {
    args.push(mapping)
  }

  const producesFullDeletes = node.props.producesFullDeletes as
    | boolean
    | undefined
  if (producesFullDeletes !== undefined) {
    args.push(`produces_full_deletes => ${producesFullDeletes}`)
  }

  return `SELECT * FROM TO_CHANGELOG(\n  ${args.join(",\n  ")}\n)`
}
