/**
 * Detail pane for a selected catalog table — header card with KPIs +
 * tabbed content (Schema / DDL / Sample data).
 *
 * The Flink catalog resolver only exposes `{ name, type }` per column
 * and no per-table stats (rows / size / snapshots / partitions / lag)
 * — those would require connector-specific queries (`information_schema`
 * for JDBC, snapshot listing for Paimon, etc.) that aren't wired yet.
 * Rather than render five misleading `—` cards, the KPI strip shows
 * data we *do* have: column count, connector type, source identifier,
 * catalog properties count, and DDL line count. The Schema tab uses
 * the mockup's 6-column grid; PK / Null / Description columns show
 * `—` placeholders since the resolver doesn't surface those fields.
 */

import { Link } from "@tanstack/react-router"
import {
  Copy,
  MoreHorizontal,
  RotateCw,
  SearchCode,
  Table as TableIcon,
} from "lucide-react"
import { useState } from "react"
import { SqlCodeViewer } from "@/components/shared/sql-code-viewer"
import type { CatalogInfo, ColumnInfo } from "@/lib/graphql-api-client"

interface CatalogTableDetailProps {
  selected: { catalog: string; database: string; table: string }
  /** Parent catalog metadata (connectorType, source, properties) used to
   *  populate the KPI strip with real data. */
  catalog: CatalogInfo | undefined
  columns: ColumnInfo[]
  ddl: string | undefined
}

type DetailTab = "schema" | "ddl" | "sample"

export function CatalogTableDetail({
  selected,
  catalog,
  columns,
  ddl,
}: CatalogTableDetailProps) {
  const [tab, setTab] = useState<DetailTab>("schema")
  const qualifiedName = `${selected.catalog}.${selected.database}.${selected.table}`
  const sampleSql = `SELECT * FROM ${qualifiedName} ORDER BY 1 DESC LIMIT 50`
  const propertyCount = catalog?.properties
    ? Object.keys(catalog.properties).length
    : 0
  const ddlLines = ddl ? ddl.split("\n").length : 0

  const copyDdl = () => {
    if (!ddl) return
    navigator.clipboard.writeText(ddl).catch(() => {})
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="glass-card-static p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <TableIcon className="size-6 shrink-0 text-fr-sage" />
            <div className="min-w-0">
              <h2 className="font-mono text-[18px] text-zinc-100 truncate">
                <span className="text-fg-faint">
                  {selected.catalog}.{selected.database}.
                </span>
                <span className="text-fg">{selected.table}</span>
              </h2>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                Catalog table · {columns.length} column
                {columns.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="status-pill running">live</span>
            <Link
              to="/hub/sql-explorer"
              search={{ q: btoa(unescape(encodeURIComponent(sampleSql))) }}
              className="btn btn-secondary btn-sm"
            >
              <SearchCode className="size-3.5" />
              Query
            </Link>
            <button
              type="button"
              onClick={copyDdl}
              disabled={!ddl}
              className="btn btn-secondary btn-sm"
            >
              <Copy className="size-3.5" />
              Copy DDL
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label="More actions"
              disabled
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Columns" value={String(columns.length)} />
          <Stat label="Connector" value={catalog?.connectorType ?? "—"} />
          <Stat label="Source" value={catalog?.source ?? "—"} />
          <Stat
            label="Properties"
            value={propertyCount > 0 ? String(propertyCount) : "—"}
          />
          <Stat
            label="DDL"
            value={ddl ? `${ddlLines} line${ddlLines === 1 ? "" : "s"}` : "—"}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dash-border">
        <TabButton active={tab === "schema"} onClick={() => setTab("schema")}>
          Schema
          <TabCount value={columns.length} />
        </TabButton>
        <TabButton active={tab === "ddl"} onClick={() => setTab("ddl")}>
          DDL
        </TabButton>
        <TabButton active={tab === "sample"} onClick={() => setTab("sample")}>
          Sample data
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === "schema" ? <SchemaTab columns={columns} /> : null}
      {tab === "ddl" ? (
        <DdlTab ddl={ddl} qualifiedName={qualifiedName} />
      ) : null}
      {tab === "sample" ? (
        <SampleDataTab qualifiedName={qualifiedName} sampleSql={sampleSql} />
      ) : null}
    </div>
  )
}

/** Stat tile scoped to the catalog table detail. Uses a darker
 *  surface (`bg-dash-surface/70`) than the global `.kpi-card` because
 *  the surrounding `.glass-card-static` parent and the global card's
 *  ~3% tint stacked together produced a barely-visible card in this
 *  context. Truncates long mono values (e.g. `paimon-catalog-jdbc`)
 *  with an ellipsis so the grid stays uniform. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dash-border/70 bg-dash-surface/70 px-4 py-3 transition-colors hover:border-fr-coral/30">
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        {label}
      </div>
      <div
        className="mt-1 truncate font-mono text-[16px] text-zinc-100"
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tab ${active ? "active" : ""}`}
    >
      {children}
    </button>
  )
}

function TabCount({ value }: { value: number }) {
  return (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fr-coral/15 px-1 font-mono text-[9px] text-fr-coral">
      {value}
    </span>
  )
}

/** Tint type strings — strings, numerics, time, complex, default. */
function typeTintClass(type: string): string {
  const lower = type.toLowerCase()
  if (
    lower.includes("varchar") ||
    lower.includes("char") ||
    lower.includes("string")
  )
    return "text-fr-amber"
  if (
    lower.includes("int") ||
    lower.includes("bigint") ||
    lower.includes("decimal") ||
    lower.includes("double") ||
    lower.includes("float")
  )
    return "text-fr-teal"
  if (
    lower.includes("timestamp") ||
    lower.includes("date") ||
    lower.includes("time")
  )
    return "text-fr-sage"
  if (
    lower.includes("array") ||
    lower.includes("map") ||
    lower.includes("row") ||
    lower.includes("struct")
  )
    return "text-fr-purple"
  return "text-fr-coral"
}

function SchemaTab({ columns }: { columns: ColumnInfo[] }) {
  if (columns.length === 0) {
    return (
      <div className="glass-card-static p-8 text-center">
        <p className="text-[12px] text-fg-muted">
          No columns loaded yet — expand the table in the tree to fetch.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="grid grid-cols-[24px_1fr_180px_60px_60px_1fr] gap-3 border-b border-dash-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span>#</span>
        <span>Column</span>
        <span>Type</span>
        <span className="text-center">PK</span>
        <span className="text-center">Null</span>
        <span>Description</span>
      </div>
      {columns.map((col, i) => (
        <div
          key={col.name}
          className="grid grid-cols-[24px_1fr_180px_60px_60px_1fr] gap-3 border-b border-dash-border/40 px-4 py-2 text-[12px] hover:bg-dash-elevated/30"
        >
          <span className="font-mono text-fg-faint">{i + 1}</span>
          <span className="font-mono text-fg truncate">{col.name}</span>
          <span className={`font-mono ${typeTintClass(col.type)} truncate`}>
            {col.type}
          </span>
          <span className="text-center font-mono text-fg-faint">—</span>
          <span className="text-center font-mono text-fg-faint">—</span>
          <span className="text-fg-faint">—</span>
        </div>
      ))}
    </div>
  )
}

function DdlTab({
  ddl,
  qualifiedName,
}: {
  ddl: string | undefined
  qualifiedName: string
}) {
  if (!ddl) {
    return (
      <div className="glass-card-static p-8 text-center">
        <p className="text-[12px] font-mono text-fg-faint">
          DDL for <span className="text-fg">{qualifiedName}</span> is loading…
        </p>
      </div>
    )
  }
  return (
    <div className="glass-card-static overflow-hidden">
      <div className="h-[480px]">
        <SqlCodeViewer value={ddl} />
      </div>
    </div>
  )
}

function SampleDataTab({
  qualifiedName,
  sampleSql,
}: {
  qualifiedName: string
  sampleSql: string
}) {
  return (
    <div className="glass-card-static p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-sans text-[14px] font-medium text-zinc-100">
          Recent rows (sample)
        </h3>
        <button type="button" disabled className="btn btn-secondary btn-sm">
          <RotateCw className="size-3.5" />
          Refresh
        </button>
      </div>
      <div className="rounded-md border border-dash-border bg-fr-bg/60 p-6 text-center">
        <p className="text-[12px] text-fg-muted">
          Sample-row preview is wired through the SQL Explorer.
        </p>
        <Link
          to="/hub/sql-explorer"
          search={{ q: btoa(unescape(encodeURIComponent(sampleSql))) }}
          className="btn btn-secondary btn-sm mt-3"
        >
          <SearchCode className="size-3.5" />
          Open in SQL Explorer
        </Link>
      </div>
      <p className="mt-3 font-mono text-[10.5px] text-fg-faint">{sampleSql}</p>
    </div>
  )
}
