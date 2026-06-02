// Markdown card builders for hover.
//
// Pure presentation: each builder turns synthesis facts into one `MarkupContent`
// (Markdown) string. A card is a header (component + kind + one-liner), then —
// as available — a schema table, a changelog-mode badge, a fenced SQL block of
// the emitted fragment, and an upstream/downstream neighbor line. Wide schemas
// and long SQL are truncated with an ellipsis + remaining count.

import { isExpressionProp } from "../expression-props.js"
import { getComponentDescription } from "./component-docs.js"
import type { Column, HoverFacts, Neighbors } from "./facts.js"
import { getPropDoc } from "./prop-docs.js"

const MAX_SCHEMA_ROWS = 12
const MAX_SQL_LINES = 16
const MAX_NEIGHBORS = 6

// ── Public builders ─────────────────────────────────────────────────

/** Component-tag card for a non-sink node (header + schema + changelog +
 *  emitted SQL + neighbors). */
export function buildTagCard(facts: HoverFacts, nodeId: string): string {
  const info = facts.getNodeInfo(nodeId)
  const component = info?.component ?? nodeId
  const parts: string[] = [header(component, info?.kind)]

  const schema = facts.getNodeSchema(nodeId)
  if (schema.columns.length > 0) parts.push(schemaTable(schema.columns))
  if (schema.changelogMode) parts.push(changelogBadge(schema.changelogMode))

  const emitted = facts.getEmittedFragment(nodeId)
  const sql = [...emitted.owned, ...emitted.fragments]
  if (sql.length > 0) parts.push(sqlBlock(sql.join("\n")))

  const neighborText = neighborLine(facts.getNeighbors(nodeId))
  if (neighborText) parts.push(neighborText)

  return parts.join("\n\n")
}

/** Sink card — the tag card plus accepted changelog modes, upstream-mode
 *  compatibility, and the DDL + `INSERT INTO` it emits. */
export function buildSinkCard(facts: HoverFacts, nodeId: string): string {
  const info = facts.getNodeInfo(nodeId)
  const component = info?.component ?? nodeId
  const parts: string[] = [header(component, info?.kind)]

  const schema = facts.getNodeSchema(nodeId)
  if (schema.columns.length > 0) parts.push(schemaTable(schema.columns))

  const accepts = facts.getSinkAccepts(nodeId)
  parts.push(changelogCompatibility(schema.changelogMode, accepts))

  const emitted = facts.getEmittedFragment(nodeId)
  const sql = [...emitted.owned, ...emitted.dml]
  if (sql.length > 0) parts.push(sqlBlock(sql.join("\n\n")))

  const neighborText = neighborLine(facts.getNeighbors(nodeId))
  if (neighborText) parts.push(neighborText)

  return parts.join("\n\n")
}

/** Connector-property card (description / type / default) — or an expression-prop
 *  note for SQL-expression props. `undefined` when the prop is undocumented. */
export function buildPropCard(
  tag: string,
  propName: string,
): string | undefined {
  if (isExpressionProp(tag, propName)) {
    return (
      `**\`${propName}\`** on \`${tag}\` · _SQL expression_\n\n` +
      "A SQL expression evaluated against the upstream schema. Hover a column " +
      "name inside it to see its inferred Flink type."
    )
  }
  const doc = getPropDoc(tag, propName)
  if (!doc) return undefined
  const lines = [`**\`${propName}\`** on \`${tag}\``, "", doc.description, ""]
  const meta = [`Type: \`${doc.type}\``]
  if (doc.default !== undefined) meta.push(`default \`${doc.default}\``)
  meta.push(doc.required ? "**required**" : "optional")
  lines.push(meta.join(" · "))
  return lines.join("\n")
}

/** Column-reference card — the field's Flink type from the upstream schema, or
 *  an explicit "unknown column" note (never asserting a type on a miss). */
export function buildColumnRefCard(
  facts: HoverFacts,
  nodeId: string,
  ident: string,
): string {
  const columns = facts.getUpstreamSchema(nodeId)
  const match =
    columns.find((c) => c.name === ident) ??
    columns.find((c) => c.name.toLowerCase() === ident.toLowerCase())

  if (match) {
    return `**\`${match.name}\`** — \`${match.type}\`\n\nColumn from the upstream schema.`
  }
  const available = columns.length
    ? `Available: ${columns.map((c) => `\`${c.name}\``).join(", ")}.`
    : "No upstream schema is available here."
  return `**\`${ident}\`** — _unknown column_\n\nNot found in the upstream schema. ${available}`
}

/** Minimal static card (header only) for the fallback path: a recognizable tag
 *  whose node is absent from the synthesis result / position map. */
export function buildStaticCard(component: string, kind?: string): string {
  return header(component, kind)
}

// ── Section helpers ─────────────────────────────────────────────────

function header(component: string, kind?: string): string {
  const tag = kind ? `**${component}** · _${kind}_` : `**${component}**`
  return `${tag}\n\n${getComponentDescription(component, kind)}`
}

function schemaTable(columns: readonly Column[]): string {
  const shown = columns.slice(0, MAX_SCHEMA_ROWS)
  const rows = shown.map((c) => `| \`${c.name}\` | \`${c.type}\` |`)
  const lines = ["| column | type |", "|---|---|", ...rows]
  const hidden = columns.length - shown.length
  if (hidden > 0) lines.push(`| … | _(+${hidden} more)_ |`)
  return lines.join("\n")
}

function changelogBadge(mode: string): string {
  return `Changelog mode: **${mode}**`
}

function changelogCompatibility(
  incoming: string | undefined,
  accepts: readonly string[] | undefined,
): string {
  const lines: string[] = []
  if (accepts && accepts.length > 0)
    lines.push(`Accepts changelog modes: ${accepts.join(", ")}`)
  if (incoming) {
    const ok =
      incoming === "append-only" || (accepts?.includes(incoming) ?? false)
    const verdict = ok ? "✓ compatible" : "✗ incompatible"
    lines.push(`Upstream mode \`${incoming}\` — ${verdict}`)
  }
  return lines.join("\n")
}

function sqlBlock(sql: string): string {
  const lines = sql.split("\n")
  let body = sql
  if (lines.length > MAX_SQL_LINES) {
    const hidden = lines.length - MAX_SQL_LINES
    body = `${lines.slice(0, MAX_SQL_LINES).join("\n")}\n-- … (+${hidden} more lines)`
  }
  return ["```sql", body, "```"].join("\n")
}

function neighborLine(neighbors: Neighbors): string {
  const fmt = (list: Neighbors["upstream"]): string => {
    if (list.length === 0) return "—"
    const shown = list.slice(0, MAX_NEIGHBORS).map((n) => `\`${n.label}\``)
    const extra = list.length - shown.length
    return shown.join(", ") + (extra > 0 ? ` _(+${extra})_` : "")
  }
  return `⬆ upstream: ${fmt(neighbors.upstream)} · ⬇ downstream: ${fmt(neighbors.downstream)}`
}
