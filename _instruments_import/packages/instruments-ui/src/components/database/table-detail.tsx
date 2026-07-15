import { Key, Link2, Loader2, Lock, Table2 } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@flink-reactor/ui"
import type { DatabaseTableDetail } from "../../types"
import { fetchDatabaseTable } from "../../api"

export function TableDetail({
  instrumentName,
  schema,
  table,
}: {
  instrumentName: string
  schema: string
  table: string
}) {
  const [detail, setDetail] = useState<DatabaseTableDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    "columns" | "indexes" | "constraints"
  >("columns")

  useEffect(() => {
    setLoading(true)
    fetchDatabaseTable(instrumentName, schema, table)
      .then((data) => {
        setDetail(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [instrumentName, schema, table])

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return <div className="glass-card p-4 text-sm text-job-failed">{error}</div>
  }

  if (!detail) return null

  const tabs = [
    {
      id: "columns" as const,
      label: `Columns (${detail.columns.length})`,
    },
    {
      id: "indexes" as const,
      label: `Indexes (${detail.indexes.length})`,
    },
    {
      id: "constraints" as const,
      label: `Constraints (${detail.constraints.length})`,
    },
  ]

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card flex items-center gap-3 p-3">
        <Table2 className="size-4 text-zinc-400" />
        <div>
          <span className="text-sm font-medium text-zinc-200">
            {detail.schema}.{detail.name}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-dash-border pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-fr-coral text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass-card overflow-hidden">
        {activeTab === "columns" && <ColumnsTable columns={detail.columns} />}
        {activeTab === "indexes" && <IndexesTable indexes={detail.indexes} />}
        {activeTab === "constraints" && (
          <ConstraintsTable constraints={detail.constraints} />
        )}
      </div>
    </div>
  )
}

function ColumnsTable({
  columns,
}: {
  columns: DatabaseTableDetail["columns"]
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-dash-border text-left text-zinc-500">
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Nullable</th>
          <th className="px-3 py-2 font-medium">Default</th>
          <th className="px-3 py-2 font-medium">Comment</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {columns.map((col) => (
          <tr key={col.name} className="hover:bg-white/[0.02]">
            <td className="px-3 py-1.5">
              <span className="flex items-center gap-1.5 text-zinc-200">
                {col.isPrimaryKey && <Key className="size-3 text-fr-amber" />}
                {col.name}
              </span>
            </td>
            <td className="px-3 py-1.5 font-mono text-zinc-400">
              {col.dataType}
            </td>
            <td className="px-3 py-1.5 text-zinc-500">
              {col.nullable ? "YES" : "NO"}
            </td>
            <td className="max-w-[200px] truncate px-3 py-1.5 font-mono text-zinc-500">
              {col.defaultValue || "\u2014"}
            </td>
            <td className="max-w-[200px] truncate px-3 py-1.5 text-zinc-500">
              {col.comment || "\u2014"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function IndexesTable({
  indexes,
}: {
  indexes: DatabaseTableDetail["indexes"]
}) {
  if (indexes.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">No indexes</div>
    )
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-dash-border text-left text-zinc-500">
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Columns</th>
          <th className="px-3 py-2 font-medium">Unique</th>
          <th className="px-3 py-2 font-medium">Type</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {indexes.map((idx) => (
          <tr key={idx.name} className="hover:bg-white/[0.02]">
            <td className="px-3 py-1.5">
              <span className="flex items-center gap-1.5 text-zinc-200">
                {idx.unique && <Lock className="size-3 text-fr-purple" />}
                {idx.name}
              </span>
            </td>
            <td className="px-3 py-1.5 font-mono text-zinc-400">
              {idx.columns.join(", ")}
            </td>
            <td className="px-3 py-1.5 text-zinc-500">
              {idx.unique ? "YES" : "NO"}
            </td>
            <td className="px-3 py-1.5 text-zinc-500">{idx.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ConstraintsTable({
  constraints,
}: {
  constraints: DatabaseTableDetail["constraints"]
}) {
  if (constraints.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">
        No constraints
      </div>
    )
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-dash-border text-left text-zinc-500">
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Columns</th>
          <th className="px-3 py-2 font-medium">References</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {constraints.map((c) => (
          <tr key={c.name} className="hover:bg-white/[0.02]">
            <td className="px-3 py-1.5 text-zinc-200">{c.name}</td>
            <td className="px-3 py-1.5">
              <span className="flex items-center gap-1.5 text-zinc-400">
                {c.type === "FOREIGN KEY" && (
                  <Link2 className="size-3 text-zinc-500" />
                )}
                {c.type}
              </span>
            </td>
            <td className="px-3 py-1.5 font-mono text-zinc-400">
              {c.columns.join(", ")}
            </td>
            <td className="px-3 py-1.5 font-mono text-zinc-500">
              {c.refTable ? `${c.refTable}(${c.refColumns.join(", ")})` : "\u2014"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
