// ── Connector Icon Gutter ────────────────────────────────────────────
// CodeMirror 6 custom gutter that displays connector brand icons
// (Kafka, ClickHouse, PostgreSQL, etc.) next to source/sink comment blocks.

import {
  type Extension,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state"
import { EditorView, GutterMarker, gutter } from "@codemirror/view"
import type { StatementMeta } from "@/lib/sandbox-synthesizer"

// ---------------------------------------------------------------------------
// SVG icon paths (from SimpleIcons — 24×24 viewBox, fill-based)
// ---------------------------------------------------------------------------

const ICON_PATHS: Record<string, string> = {
  // Apache Kafka
  kafka:
    "M9.71 2.136a1.43 1.43 0 0 0-2.047 0h-.007a1.48 1.48 0 0 0-.421 1.042c0 .41.161.777.422 1.039l.007.007c.257.264.616.426 1.019.426.404 0 .766-.162 1.027-.426l.003-.007c.261-.262.421-.629.421-1.039 0-.408-.159-.777-.421-1.042H9.71zM8.683 22.295c.404 0 .766-.167 1.027-.429l.003-.008c.261-.261.421-.631.421-1.036 0-.41-.159-.778-.421-1.044H9.71a1.42 1.42 0 0 0-1.027-.432 1.4 1.4 0 0 0-1.02.432h-.007c-.26.266-.422.634-.422 1.044 0 .406.161.775.422 1.036l.007.008c.258.262.617.429 1.02.429zm7.89-4.462c.359-.096.683-.33.882-.684l.027-.052a1.47 1.47 0 0 0 .114-1.067 1.454 1.454 0 0 0-.675-.896l-.021-.014a1.425 1.425 0 0 0-1.078-.132c-.36.091-.684.335-.881.686-.2.349-.241.75-.146 1.119.099.363.33.691.675.896h.002c.346.203.737.239 1.101.144zm-6.405-7.342a2.083 2.083 0 0 0-1.485-.627c-.58 0-1.103.242-1.482.627-.378.385-.612.916-.612 1.507s.233 1.124.612 1.514a2.08 2.08 0 0 0 2.967 0c.379-.39.612-.923.612-1.514s-.233-1.122-.612-1.507zm-.835-2.51c.843.141 1.6.552 2.178 1.144h.004c.092.093.182.196.265.299l1.446-.851a3.176 3.176 0 0 1-.047-1.808 3.149 3.149 0 0 1 1.456-1.926l.025-.016a3.062 3.062 0 0 1 2.345-.306c.77.21 1.465.721 1.898 1.482v.002c.431.757.518 1.626.313 2.408a3.145 3.145 0 0 1-1.456 1.928l-.198.118h-.02a3.095 3.095 0 0 1-2.154.201 3.127 3.127 0 0 1-1.514-.944l-1.444.848a4.162 4.162 0 0 1 0 2.879l1.444.846c.413-.47.939-.789 1.514-.944a3.041 3.041 0 0 1 2.371.319l.048.023v.002a3.17 3.17 0 0 1 1.408 1.906 3.215 3.215 0 0 1-.313 2.405l-.026.053-.003-.005a3.147 3.147 0 0 1-1.867 1.436 3.096 3.096 0 0 1-2.371-.318v-.006a3.156 3.156 0 0 1-1.456-1.927 3.175 3.175 0 0 1 .047-1.805l-1.446-.848a3.905 3.905 0 0 1-.265.294l-.004.005a3.938 3.938 0 0 1-2.178 1.138v1.699a3.09 3.09 0 0 1 1.56.862l.002.004c.565.572.914 1.368.914 2.243 0 .873-.35 1.664-.914 2.239l-.002.009a3.1 3.1 0 0 1-2.21.931 3.1 3.1 0 0 1-2.206-.93h-.002v-.009a3.186 3.186 0 0 1-.916-2.239c0-.875.35-1.672.916-2.243v-.004h.002a3.1 3.1 0 0 1 1.558-.862v-1.699a3.926 3.926 0 0 1-2.176-1.138l-.006-.005a4.098 4.098 0 0 1-1.173-2.874c0-1.122.452-2.136 1.173-2.872h.006a3.947 3.947 0 0 1 2.176-1.144V6.289a3.137 3.137 0 0 1-1.558-.864h-.002v-.004a3.192 3.192 0 0 1-.916-2.243c0-.871.35-1.669.916-2.243l.002-.002A3.084 3.084 0 0 1 8.683 0c.861 0 1.641.355 2.21.932v.002h.002c.565.574.914 1.372.914 2.243 0 .876-.35 1.667-.914 2.243l-.002.005a3.142 3.142 0 0 1-1.56.864v1.692zm8.121-1.129l-.012-.019a1.452 1.452 0 0 0-.87-.668 1.43 1.43 0 0 0-1.103.146h.002c-.347.2-.58.529-.677.896-.095.365-.054.768.146 1.119l.007.009c.2.347.519.579.874.673.357.103.755.059 1.098-.144l.019-.009a1.47 1.47 0 0 0 .657-.885 1.493 1.493 0 0 0-.141-1.118",
  // ClickHouse
  clickhouse:
    "M21.333 10H24v4h-2.667ZM16 1.335h2.667v21.33H16Zm-5.333 0h2.666v21.33h-2.666ZM0 22.665V1.335h2.667v21.33zm5.333-21.33H8v21.33H5.333Z",
  // PostgreSQL
  postgresql:
    "M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698z",
  // MySQL
  mysql:
    "M16.405 5.501c-.115 0-.193.014-.274.033v.013h.014c.054.104.146.18.214.273.054.107.1.214.154.32l.014-.015c.094-.066.14-.172.14-.333-.04-.047-.046-.094-.08-.14-.04-.067-.126-.1-.18-.153zM5.77 18.695h-.927a50.854 50.854 0 00-.27-4.41h-.008l-1.41 4.41H2.45l-1.4-4.41h-.01a72.892 72.892 0 00-.195 4.41H0c.055-1.966.192-3.81.41-5.53h1.15l1.335 4.064h.008l1.347-4.064h1.095c.242 2.015.384 3.86.428 5.53z",
  // Elasticsearch
  elasticsearch:
    "M13.394 0C8.683 0 4.609 2.716 2.644 6.667h15.641a4.77 4.77 0 0 0 3.073-1.11c.446-.375.864-.785 1.247-1.243l.001-.002A11.974 11.974 0 0 0 13.394 0zM1.804 8.889a12.009 12.009 0 0 0 0 6.222h14.7a3.111 3.111 0 1 0 0-6.222zm.84 8.444C4.61 21.283 8.684 24 13.395 24c3.701 0 7.011-1.677 9.212-4.312l-.001-.002a9.958 9.958 0 0 0-1.247-1.243 4.77 4.77 0 0 0-3.073-1.11z",
  // MongoDB
  mongodb:
    "M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z",
  // Redis
  redis:
    "M22.71 13.145c-1.66 2.092-3.452 4.483-7.038 4.483-3.203 0-4.397-2.825-4.48-5.12.701 1.484 2.073 2.685 4.214 2.63 4.117-.133 6.94-3.852 6.94-7.239 0-4.05-3.022-6.972-8.268-6.972-3.752 0-8.4 1.428-11.455 3.685C2.59 6.937 3.885 9.958 4.35 9.626c2.648-1.904 4.748-3.13 6.784-3.744C8.12 9.244.886 17.05 0 18.425c.1 1.261 1.66 4.648 2.424 4.648.232 0 .431-.133.664-.365a100.49 100.49 0 0 0 5.54-6.765c.222 3.104 1.748 6.898 6.014 6.898 3.819 0 7.604-2.756 9.33-8.965.2-.764-.73-1.361-1.261-.73zm-4.349-5.013c0 1.959-1.926 2.922-3.685 2.922-.941 0-1.664-.247-2.235-.568 1.051-1.592 2.092-3.225 3.21-4.973 1.972.334 2.71 1.43 2.71 2.619z",
}

// Lucide-style stroke icons (24×24, stroke-based) for generic types
const STROKE_ICONS: Record<string, string> = {
  // Database (generic JDBC / database)
  database:
    "M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zM2 11.5c0 2.485 4.48 4.5 10 4.5s10-2.015 10-4.5M2 6.5C2 8.985 6.48 11 12 11s10-2.015 10-4.5",
  // Terminal (print / debug sink)
  terminal: "M4 17l6-6-6-6M12 19h8",
  // Plug (generic connector)
  plug: "M12 2v6m-4-2v4a4 4 0 0 0 8 0V6M8 22h8m-4-6v6",
  // Filter (transform)
  filter: "M22 3H2l8 9.46V19l4 2V12.46L22 3z",
  // Play (pipeline)
  pipeline: "M5 3l14 9-14 9V3z",
  // FileText (filesystem)
  filesystem:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
}

// ---------------------------------------------------------------------------
// JDBC URL → database brand detection
// ---------------------------------------------------------------------------

const JDBC_PATTERNS: Array<{
  pattern: RegExp
  key: string
  type: "fill" | "stroke"
  label: string
}> = [
  { pattern: /jdbc:postgresql/i, key: "postgresql", type: "fill", label: "PostgreSQL" },
  { pattern: /jdbc:mysql/i, key: "mysql", type: "fill", label: "MySQL" },
  { pattern: /jdbc:clickhouse/i, key: "clickhouse", type: "fill", label: "ClickHouse" },
  { pattern: /jdbc:mongodb/i, key: "mongodb", type: "fill", label: "MongoDB" },
  { pattern: /jdbc:sqlserver/i, key: "database", type: "stroke", label: "SQL Server" },
  { pattern: /jdbc:oracle/i, key: "database", type: "stroke", label: "Oracle" },
  { pattern: /jdbc:sqlite/i, key: "database", type: "stroke", label: "SQLite" },
  { pattern: /jdbc:mariadb/i, key: "mysql", type: "fill", label: "MariaDB" },
  { pattern: /jdbc:h2/i, key: "database", type: "stroke", label: "H2" },
  { pattern: /jdbc:derby/i, key: "database", type: "stroke", label: "Derby" },
]

function resolveJdbcIcon(
  url: string,
): { key: string; type: "fill" | "stroke"; label: string } {
  for (const { pattern, key, type, label } of JDBC_PATTERNS) {
    if (pattern.test(url)) return { key, type, label }
  }
  return { key: "database", type: "stroke", label: "JDBC" }
}

// ---------------------------------------------------------------------------
// Icon key + label for display names
// ---------------------------------------------------------------------------

interface ResolvedIcon {
  key: string
  type: "fill" | "stroke"
  label: string
}

/** Map component names to icon keys. `jdbcUrl` enables smart JDBC detection. */
function resolveIconKey(component: string, jdbcUrl?: string): ResolvedIcon | null {
  switch (component) {
    case "KafkaSource":
      return { key: "kafka", type: "fill", label: "Kafka Source" }
    case "KafkaSink":
      return { key: "kafka", type: "fill", label: "Kafka Sink" }
    case "JdbcSource": {
      const jdbc = jdbcUrl ? resolveJdbcIcon(jdbcUrl) : { key: "database", type: "stroke" as const, label: "JDBC" }
      return { ...jdbc, label: `${jdbc.label} Source` }
    }
    case "JdbcSink": {
      const jdbc = jdbcUrl ? resolveJdbcIcon(jdbcUrl) : { key: "database", type: "stroke" as const, label: "JDBC" }
      return { ...jdbc, label: `${jdbc.label} Sink` }
    }
    case "GenericSource":
      return { key: "plug", type: "stroke", label: "Generic Source" }
    case "GenericSink":
      return { key: "plug", type: "stroke", label: "Generic Sink" }
    case "FileSystemSink":
      return { key: "filesystem", type: "stroke", label: "FileSystem Sink" }
    case "IcebergSink":
      return { key: "database", type: "stroke", label: "Iceberg Sink" }
    case "PaimonSink":
      return { key: "database", type: "stroke", label: "Paimon Sink" }
    default:
      // Check if connector type name matches a known brand
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
          return { key: brand, type: "fill", label: component }
      }
      return null
  }
}

function createIconSvg(
  iconKey: string,
  type: "fill" | "stroke",
): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("width", "14")
  svg.setAttribute("height", "14")
  svg.classList.add("cm-connector-icon-svg")

  if (type === "fill") {
    svg.setAttribute("fill", "currentColor")
    svg.setAttribute("stroke", "none")
    const path = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    )
    path.setAttribute("d", ICON_PATHS[iconKey] ?? "")
    svg.appendChild(path)
  } else {
    svg.setAttribute("fill", "none")
    svg.setAttribute("stroke", "currentColor")
    svg.setAttribute("stroke-width", "2")
    svg.setAttribute("stroke-linecap", "round")
    svg.setAttribute("stroke-linejoin", "round")
    const pathData = STROKE_ICONS[iconKey] ?? ""
    // Stroke icons may have multiple path segments separated by M commands
    for (const seg of pathData.split(/(?=M)/)) {
      if (!seg.trim()) continue
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      )
      path.setAttribute("d", seg)
      svg.appendChild(path)
    }
  }

  return svg
}

// ---------------------------------------------------------------------------
// GutterMarker subclass
// ---------------------------------------------------------------------------

class ConnectorIconMarker extends GutterMarker {
  constructor(
    readonly iconKey: string,
    readonly iconType: "fill" | "stroke",
    readonly label: string,
  ) {
    super()
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement("div")
    wrapper.className = "cm-connector-icon"
    wrapper.dataset.label = this.label
    wrapper.appendChild(createIconSvg(this.iconKey, this.iconType))
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
  lineIcons: Map<
    number,
    { key: string; type: "fill" | "stroke"; label: string }
  >
}

export const setConnectorIcons =
  StateEffect.define<ConnectorIconData | null>()

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

let iconTooltipEl: HTMLDivElement | null = null

function showIconTooltip(label: string, anchor: HTMLElement) {
  hideIconTooltip()
  iconTooltipEl = document.createElement("div")
  iconTooltipEl.className = "cm-connector-tooltip"
  Object.assign(iconTooltipEl.style, {
    position: "fixed",
    zIndex: "1000",
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid color-mix(in srgb, var(--color-fr-purple) 40%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--color-fr-purple) 12%, var(--color-dash-surface))",
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

function hideIconTooltip() {
  if (iconTooltipEl) {
    iconTooltipEl.remove()
    iconTooltipEl = null
  }
}

// ---------------------------------------------------------------------------
// Gutter extension
// ---------------------------------------------------------------------------

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
          marker: new ConnectorIconMarker(icon.key, icon.type, icon.label),
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
  const lineIcons = new Map<
    number,
    { key: string; type: "fill" | "stroke"; label: string }
  >()
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
  const lineIcons = new Map<
    number,
    { key: string; type: "fill" | "stroke"; label: string }
  >()
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
function extractJdbcUrl(lines: string[], startLine: number): string | undefined {
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
