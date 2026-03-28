import {
  Database,
  FileText,
  HardDrive,
  Layers,
  type LucideIcon,
  MessageSquare,
} from "lucide-react"
import type { CatalogInfo } from "@/lib/graphql-api-client"
import { cn } from "@/lib/cn"

/** Maps connector type strings to representative icons. */
export const connectorIcons: Record<string, LucideIcon> = {
  kafka: MessageSquare,
  iceberg: Layers,
  paimon: HardDrive,
  jdbc: Database,
  filesystem: FileText,
}

/** Human-readable labels for connector types. */
export const connectorLabels: Record<string, string> = {
  kafka: "Kafka",
  iceberg: "Iceberg",
  paimon: "Paimon",
  jdbc: "JDBC",
  filesystem: "FileSystem",
}

/** Brand-consistent colors for each connector type. */
export const connectorColors: Record<string, string> = {
  kafka: "text-fr-coral",
  iceberg: "text-blue-400",
  paimon: "text-status-active",
  jdbc: "text-fr-purple",
  filesystem: "text-fr-amber",
}

/** Background tints matching connector colors. */
const connectorBg: Record<string, string> = {
  kafka: "bg-fr-coral/10",
  jdbc: "bg-fr-purple/10",
  iceberg: "bg-blue-400/10",
  paimon: "bg-status-active/10",
  filesystem: "bg-fr-amber/10",
}

/**
 * Parses a JDBC URL into a human-readable summary.
 * "jdbc:postgresql://host:port/dbname" -> "PostgreSQL @ host:port/dbname"
 */
function parseJdbcUrl(url: string): string {
  const match = url.match(/^jdbc:(\w+):\/\/(.+)/)
  if (!match) return url
  const dbType = match[1].charAt(0).toUpperCase() + match[1].slice(1)
  return `${dbType} @ ${match[2]}`
}

/**
 * Formats connector properties into a parsed, human-readable one-line summary.
 * Sensitive fields (username, password) are never shown.
 */
export function formatCatalogSummary(
  connectorType: string,
  properties: Record<string, string> | null,
): string {
  if (!properties) return ""

  switch (connectorType) {
    case "jdbc": {
      const url = properties["url"] ?? ""
      return url ? parseJdbcUrl(url) : ""
    }
    case "kafka": {
      const servers = properties["properties.bootstrap.servers"] ?? ""
      const format = properties["format"] ?? ""
      const parts: string[] = []
      if (servers) parts.push(servers)
      if (format) parts.push(format)
      return parts.join(" · ")
    }
    default:
      return ""
  }
}

/** Compact sidebar item for a catalog, showing icon + name + type badge. */
export function CatalogItem({
  catalog,
  selected,
  onClick,
}: {
  catalog: CatalogInfo
  selected: boolean
  onClick: () => void
}) {
  const Icon = connectorIcons[catalog.connectorType] ?? Database
  const label =
    connectorLabels[catalog.connectorType] ?? (catalog.connectorType || "Catalog")
  const color = connectorColors[catalog.connectorType] ?? "text-zinc-400"
  const bg = connectorBg[catalog.connectorType] ?? "bg-zinc-500/10"
  const summary = formatCatalogSummary(
    catalog.connectorType,
    catalog.properties,
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
        selected
          ? "bg-white/[0.06]"
          : "hover:bg-white/[0.03]",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded",
          color,
          selected ? bg : "bg-dash-panel",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-xs font-medium",
              selected ? "text-zinc-100" : "text-zinc-300",
            )}
          >
            {catalog.name}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium uppercase",
              color,
              bg,
            )}
          >
            {label}
          </span>
        </div>
        {summary && (
          <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
            {summary}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
          <span>{catalog.databaseCount} db</span>
          <span>{catalog.tableCount} tables</span>
        </div>
      </div>
    </button>
  )
}
