import { Link } from "@tanstack/react-router"
import type { MaterializedTable } from "@flink-reactor/ui"
import { RefreshStatusBadge } from "./refresh-status-badge"

interface MaterializedTablesTableProps {
  tables: MaterializedTable[]
}

export function MaterializedTablesTable({
  tables,
}: MaterializedTablesTableProps) {
  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <p className="text-sm">No materialized tables found</p>
        <p className="mt-1 text-xs">
          Configure SQL Gateway access to view materialized tables, or create
          one using the FlinkReactor DSL
        </p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-dash-border text-left text-xs uppercase tracking-wider text-zinc-500">
          <th className="px-4 py-2 font-medium">Name</th>
          <th className="px-4 py-2 font-medium">Catalog</th>
          <th className="px-4 py-2 font-medium">Database</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Refresh Mode</th>
          <th className="px-4 py-2 font-medium">Freshness</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {tables.map((t) => (
          <tr
            key={`${t.catalog}/${t.database}/${t.name}`}
            className="transition-colors hover:bg-dash-surface/50"
          >
            <td className="px-4 py-2.5">
              <Link
                to={`/materialized-tables/${encodeURIComponent(t.name)}?catalog=${encodeURIComponent(t.catalog)}`}
                className="font-medium text-zinc-200 hover:text-fr-coral transition-colors"
              >
                {t.name}
              </Link>
            </td>
            <td className="px-4 py-2.5 text-zinc-400">{t.catalog}</td>
            <td className="px-4 py-2.5 text-zinc-400">{t.database || "-"}</td>
            <td className="px-4 py-2.5">
              <RefreshStatusBadge status={t.refreshStatus} />
            </td>
            <td className="px-4 py-2.5 text-zinc-400">
              {t.refreshMode ?? "-"}
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
              {t.freshness ?? "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
