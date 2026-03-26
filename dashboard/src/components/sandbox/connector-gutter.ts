/**
 * CodeMirror 6 custom gutter that displays connector brand icons
 * (Kafka, ClickHouse, PostgreSQL, etc.) next to source/sink lines.
 *
 * Brand icons are rendered via react-icons (SimpleIcons set) using
 * `flushSync` into a DOM cache, then cloned into gutter markers.
 * Generic connectors use inline Lucide-style SVG paths.
 */

import {
  type Extension,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state"
import { GutterMarker, gutter } from "@codemirror/view"
import { createElement } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import type { IconType } from "react-icons"
import {
  SiApachekafka,
  SiClickhouse,
  SiElasticsearch,
  SiMongodb,
  SiMysql,
  SiPostgresql,
  SiRedis,
} from "react-icons/si"
import type { StatementMeta } from "@/lib/sandbox-synthesizer"

// ---------------------------------------------------------------------------
// Icon registry — react-icons rendered once via flushSync, cached as HTML
// ---------------------------------------------------------------------------

/** Brand icons (SimpleIcons) */
const BRAND_ICONS: Record<string, IconType> = {
  kafka: SiApachekafka,
  clickhouse: SiClickhouse,
  postgresql: SiPostgresql,
  mysql: SiMysql,
  mongodb: SiMongodb,
  redis: SiRedis,
  elasticsearch: SiElasticsearch,
}

/** Lucide-style SVG paths for generic connector types (24×24, stroke-based) */
const GENERIC_SVG: Record<string, string> = {
  database:
    "M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zM2 11.5c0 2.485 4.48 4.5 10 4.5s10-2.015 10-4.5M2 6.5C2 8.985 6.48 11 12 11s10-2.015 10-4.5",
  terminal: "M4 17l6-6-6-6M12 19h8",
  plug: "M12 2v6m-4-2v4a4 4 0 0 0 8 0V6M8 22h8m-4-6v6",
  filesystem:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
}

/** Cached SVG outerHTML keyed by icon name. Lazy-initialized on first use. */
const svgHtmlCache = new Map<string, string>()
let cacheReady = false

/** Lazily pre-renders all brand and generic icons into the HTML cache. */
function ensureIconCache(): void {
  if (cacheReady) return
  cacheReady = true

  // Pre-render each brand icon via flushSync → extract outerHTML
  for (const [key, Icon] of Object.entries(BRAND_ICONS)) {
    const container = document.createElement("div")
    const root = createRoot(container)
    flushSync(() => {
      root.render(
        createElement(Icon, { size: 16, className: "cm-connector-icon-svg" }),
      )
    })
    svgHtmlCache.set(key, container.innerHTML)
    root.unmount()
  }

  // Build stroke SVGs for generic icons
  for (const [key, pathData] of Object.entries(GENERIC_SVG)) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("width", "16")
    svg.setAttribute("height", "16")
    svg.setAttribute("fill", "none")
    svg.setAttribute("stroke", "currentColor")
    svg.setAttribute("stroke-width", "2")
    svg.setAttribute("stroke-linecap", "round")
    svg.setAttribute("stroke-linejoin", "round")
    svg.classList.add("cm-connector-icon-svg")
    for (const seg of pathData.split(/(?=M)/)) {
      if (!seg.trim()) continue
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      )
      path.setAttribute("d", seg)
      svg.appendChild(path)
    }
    svgHtmlCache.set(key, svg.outerHTML)
  }
}

/** Retrieve cached SVG HTML for the given icon key, or empty string if unknown. */
function getIconHtml(iconKey: string): string {
  ensureIconCache()
  return svgHtmlCache.get(iconKey) ?? ""
}

// ---------------------------------------------------------------------------
// JDBC URL → database brand detection
// ---------------------------------------------------------------------------

/** Ordered list of JDBC URL patterns mapped to icon keys and display labels. */
const JDBC_PATTERNS: Array<{
  pattern: RegExp
  key: string
  label: string
}> = [
  { pattern: /jdbc:postgresql/i, key: "postgresql", label: "PostgreSQL" },
  { pattern: /jdbc:mysql/i, key: "mysql", label: "MySQL" },
  { pattern: /jdbc:clickhouse/i, key: "clickhouse", label: "ClickHouse" },
  { pattern: /jdbc:mongodb/i, key: "mongodb", label: "MongoDB" },
  { pattern: /jdbc:sqlserver/i, key: "database", label: "SQL Server" },
  { pattern: /jdbc:oracle/i, key: "database", label: "Oracle" },
  { pattern: /jdbc:sqlite/i, key: "database", label: "SQLite" },
  { pattern: /jdbc:mariadb/i, key: "mysql", label: "MariaDB" },
  { pattern: /jdbc:h2/i, key: "database", label: "H2" },
  { pattern: /jdbc:derby/i, key: "database", label: "Derby" },
]

/** Match a JDBC URL against known database brands and return the icon key + label. */
function resolveJdbcIcon(url: string): { key: string; label: string } {
  for (const { pattern, key, label } of JDBC_PATTERNS) {
    if (pattern.test(url)) return { key, label }
  }
  return { key: "database", label: "JDBC" }
}

// ---------------------------------------------------------------------------
// Component → icon resolution
// ---------------------------------------------------------------------------

/** Result of icon resolution: the cache key and human-readable label. */
interface ResolvedIcon {
  key: string
  label: string
}

/** Map component names to icon keys. `jdbcUrl` enables smart JDBC detection. */
function resolveIconKey(
  component: string,
  jdbcUrl?: string,
): ResolvedIcon | null {
  switch (component) {
    case "KafkaSource":
      return { key: "kafka", label: "Kafka Source" }
    case "KafkaSink":
      return { key: "kafka", label: "Kafka Sink" }
    case "JdbcSource": {
      const jdbc = jdbcUrl
        ? resolveJdbcIcon(jdbcUrl)
        : { key: "database", label: "JDBC" }
      return { key: jdbc.key, label: `${jdbc.label} Source` }
    }
    case "JdbcSink": {
      const jdbc = jdbcUrl
        ? resolveJdbcIcon(jdbcUrl)
        : { key: "database", label: "JDBC" }
      return { key: jdbc.key, label: `${jdbc.label} Sink` }
    }
    case "GenericSource":
      return { key: "plug", label: "Generic Source" }
    case "GenericSink":
      return { key: "plug", label: "Generic Sink" }
    case "FileSystemSink":
      return { key: "filesystem", label: "FileSystem Sink" }
    case "IcebergSink":
      return { key: "database", label: "Iceberg Sink" }
    case "PaimonSink":
      return { key: "database", label: "Paimon Sink" }
    default:
      for (const brand of [
        "kafka",
        "clickhouse",
        "postgresql",
        "mysql",
        "mongodb",
        "redis",
        "elasticsearch",
      ]) {
        if (component.toLowerCase().includes(brand))
          return { key: brand, label: component }
      }
      return null
  }
}

// ---------------------------------------------------------------------------
// GutterMarker subclass
// ---------------------------------------------------------------------------

/** GutterMarker that renders a cached connector SVG icon in the editor gutter. */
class ConnectorIconMarker extends GutterMarker {
  constructor(
    readonly iconKey: string,
    readonly label: string,
  ) {
    super()
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement("div")
    wrapper.className = "cm-connector-icon"
    wrapper.dataset.label = this.label
    wrapper.innerHTML = getIconHtml(this.iconKey)
    return wrapper
  }

  override eq(other: GutterMarker): boolean {
    return (
      other instanceof ConnectorIconMarker &&
      other.iconKey === this.iconKey &&
      other.label === this.label
    )
  }
}

// ---------------------------------------------------------------------------
// State effect + field
// ---------------------------------------------------------------------------

/** Maps 0-based line indices to icon info. */
export interface ConnectorIconData {
  lineIcons: Map<number, { key: string; label: string }>
}

/** State effect to update the connector icon overlay. Dispatch `null` to clear. */
export const setConnectorIcons = StateEffect.define<ConnectorIconData | null>()

/** State field that stores the current connector icon mapping. */
const connectorIconField = StateField.define<ConnectorIconData | null>({
  create: () => null,
  update(data, tr) {
    for (const e of tr.effects) {
      if (e.is(setConnectorIcons)) return e.value
    }
    return data
  },
})

// ---------------------------------------------------------------------------
// Tooltip (shared with diagnostic gutter pattern)
// ---------------------------------------------------------------------------

/** Singleton tooltip element, lazily created on hover. */
let iconTooltipEl: HTMLDivElement | null = null

/** Position and show a floating tooltip next to the hovered gutter icon. */
function showIconTooltip(label: string, anchor: HTMLElement) {
  hideIconTooltip()
  iconTooltipEl = document.createElement("div")
  iconTooltipEl.className = "cm-connector-tooltip"
  Object.assign(iconTooltipEl.style, {
    position: "fixed",
    zIndex: "1000",
    padding: "4px 10px",
    borderRadius: "6px",
    border:
      "1px solid color-mix(in srgb, var(--color-fr-purple) 40%, transparent)",
    backgroundColor:
      "color-mix(in srgb, var(--color-fr-purple) 12%, var(--color-dash-surface))",
    backdropFilter: "blur(8px)",
    color: "var(--color-fr-purple)",
    fontSize: "11px",
    lineHeight: "1.5",
    fontWeight: "500",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  })
  iconTooltipEl.textContent = label
  document.body.appendChild(iconTooltipEl)

  const rect = anchor.getBoundingClientRect()
  iconTooltipEl.style.left = `${rect.right + 6}px`
  iconTooltipEl.style.top = `${rect.top - 2}px`
}

/** Remove and dispose the active tooltip element. */
function hideIconTooltip() {
  if (iconTooltipEl) {
    iconTooltipEl.remove()
    iconTooltipEl = null
  }
}

// ---------------------------------------------------------------------------
// Gutter extension
// ---------------------------------------------------------------------------

/** Gutter definition that reads the icon state field and renders markers. */
const connectorGutter = gutter({
  class: "cm-connector-gutter",
  markers: (view) => {
    const data = view.state.field(connectorIconField)
    if (!data || data.lineIcons.size === 0) return RangeSet.empty

    const markers: Array<{ from: number; marker: GutterMarker }> = []
    for (const [lineIdx, icon] of data.lineIcons) {
      const lineNum = lineIdx + 1 // 1-based
      if (lineNum <= view.state.doc.lines) {
        const line = view.state.doc.line(lineNum)
        markers.push({
          from: line.from,
          marker: new ConnectorIconMarker(icon.key, icon.label),
        })
      }
    }
    markers.sort((a, b) => a.from - b.from)
    return RangeSet.of(markers.map((m) => m.marker.range(m.from)))
  },
  domEventHandlers: {
    mouseover(_view, _line, event) {
      const target = event.target as HTMLElement
      const iconEl = target.closest(".cm-connector-icon")
      if (!iconEl) return false
      const label = (iconEl as HTMLElement).dataset.label
      if (label) showIconTooltip(label, iconEl as HTMLElement)
      return false
    },
    mouseout() {
      hideIconTooltip()
      return false
    },
  },
})

/** Bundled CodeMirror extension: state field + gutter for connector icons. */
export const connectorIconGutter: Extension = [
  connectorIconField,
  connectorGutter,
]

/** Clean up tooltip on editor destroy. */
export function cleanupConnectorTooltip(): void {
  hideIconTooltip()
}

// ---------------------------------------------------------------------------
// Compute icon positions from statement metadata
// ---------------------------------------------------------------------------

/** Compute connector icons for SQL output (from statement metadata). */
export function computeConnectorIcons(
  statements: readonly string[],
  commentIndices: ReadonlySet<number>,
  statementMeta: ReadonlyMap<number, StatementMeta>,
): ConnectorIconData {
  const lineIcons = new Map<number, { key: string; label: string }>()
  let lineNum = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const stmtLines = stmt.split("\n")

    if (commentIndices.has(i)) {
      const meta = statementMeta.get(i)
      if (
        meta &&
        (meta.section === "sources" || meta.section === "sinks") &&
        meta.component
      ) {
        // Extract JDBC URL from meta details for smart icon detection
        const urlDetail = meta.details.find(
          (d) => d.key === "url" || d.key === "base-url",
        )
        const icon = resolveIconKey(meta.component, urlDetail?.value)
        if (icon) {
          // Place icon on the type label line (2nd line: "-- SOURCE TABLE")
          lineIcons.set(lineNum + 1, icon)
        }
      }
    }

    lineNum += stmtLines.length + 1 // +1 for blank line between statements
  }

  return { lineIcons }
}

// ---------------------------------------------------------------------------
// TSX connector icon scanning
// ---------------------------------------------------------------------------

/** Known source/sink component names for TSX scanning. */
const TSX_COMPONENTS = [
  "KafkaSource",
  "KafkaSink",
  "JdbcSource",
  "JdbcSink",
  "GenericSource",
  "GenericSink",
  "FileSystemSink",
  "IcebergSink",
  "PaimonSink",
]

/** Compute connector icons for TSX editor by scanning for component tags. */
export function computeTsxConnectorIcons(code: string): ConnectorIconData {
  const lineIcons = new Map<number, { key: string; label: string }>()
  const lines = code.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const comp of TSX_COMPONENTS) {
      if (!new RegExp(`<${comp}(\\s|>|$|/)`).test(line)) continue

      // For JDBC, try to extract `url` prop from the same or following lines
      let jdbcUrl: string | undefined
      if (comp === "JdbcSource" || comp === "JdbcSink") {
        jdbcUrl = extractJdbcUrl(lines, i)
      }

      const icon = resolveIconKey(comp, jdbcUrl)
      if (icon) lineIcons.set(i, icon)
      break // one icon per line
    }
  }

  return { lineIcons }
}

/**
 * Extract the `url` prop value from a JSX element starting at `startLine`.
 * Scans forward through multi-line props until the tag closes.
 */
function extractJdbcUrl(
  lines: string[],
  startLine: number,
): string | undefined {
  for (let i = startLine; i < Math.min(startLine + 15, lines.length); i++) {
    const urlMatch = lines[i].match(/url\s*=\s*["'{]([^"'}]+)["'}]/)
    if (urlMatch) return urlMatch[1]
    // Stop scanning at tag close
    if (i > startLine && (lines[i].includes("/>") || lines[i].includes(">"))) {
      break
    }
  }
  return undefined
}
