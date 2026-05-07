/**
 * Detail pane for a selected catalog table — header card with KPIs +
 * tabbed content (Schema / DDL / Sample data).
 *
 * Mirrors `console-v2/catalogs.html` lines 173-365. KPI counts (rows,
 * size, snapshots, partitions, avg-lag) are not exposed by the GraphQL
 * `catalogs` resolver today, so they render as `—` placeholders. The
 * Schema tab uses the mockup's 6-column grid (`# / Column / Type / PK /
 * Null / Description`) — PK / Null / Description show `—` since
 * `ColumnInfo` is `{ name, type }` only. DDL is real (from
 * `catalogTableDDL`); Sample data links to the SQL Explorer with a
 * pre-filled `SELECT * LIMIT 50`.
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
import type { ColumnInfo } from "@/lib/graphql-api-client"

interface CatalogTableDetailProps {
  selected: { catalog: string; database: string; table: string }
  columns: ColumnInfo[]
  ddl: string | undefined
}

type DetailTab = "schema" | "ddl" | "sample"

export function CatalogTableDetail({
  selected,
  columns,
  ddl,
}: CatalogTableDetailProps) {
  const [tab, setTab] = useState<DetailTab>("schema")
  const qualifiedName = `${selected.catalog}.${selected.database}.${selected.table}`
  const sampleSql = `SELECT * FROM ${qualifiedName} ORDER BY 1 DESC LIMIT 50`

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
          <KpiCard label="Rows" value="—" />
          <KpiCard label="Size" value="—" />
          <KpiCard label="Snapshots" value="—" />
          <KpiCard label="Partitions" value="—" />
          <KpiCard label="Avg lag" value="—" />
        </div>
        <p className="mt-2 font-mono text-[10px] text-fg-faint">
          Stats not yet exposed by the catalog resolver — placeholder.
        </p>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
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
      <pre className="code-viewer max-h-[480px] overflow-auto p-4 font-mono text-[11.5px] whitespace-pre-wrap">
        {ddl}
      </pre>
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
