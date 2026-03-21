import type { MaterializedTableRefreshStatus } from "@flink-reactor/ui"
import { RefreshStatusBadge } from "@flink-reactor/ui"
import { createMaterializedTable } from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const table = createMaterializedTable()

const refreshStatusBadgeProps: PropDef[] = [
  {
    name: "status",
    type: '"ACTIVATED" | "SUSPENDED" | "INITIALIZING"',
    description: "Refresh status determining the badge color and label",
  },
  {
    name: "className",
    type: "string",
    default: "undefined",
    description: "Additional CSS classes",
  },
]

const TOC = [{ id: "refresh-status-badge", label: "RefreshStatusBadge" }]

const statuses: MaterializedTableRefreshStatus[] = [
  "ACTIVATED",
  "SUSPENDED",
  "INITIALIZING",
]

function MaterializedTablesDomainPage() {
  return (
    <ShowcasePage
      title="Materialized Tables"
      description="Materialized view components. 1 component."
      items={TOC}
    >
      <Section
        id="refresh-status-badge"
        title="RefreshStatusBadge"
        description="Status badge with animated dot indicating materialized table refresh state."
      >
        <div className="flex flex-col gap-6">
          {/* All status variants */}
          <div className="flex items-center gap-4">
            {statuses.map((status) => (
              <RefreshStatusBadge key={status} status={status} />
            ))}
          </div>

          {/* In context: sample table card */}
          <div className="glass-card max-w-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">
                  {table.name}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">
                  {table.catalog}.{table.database}
                </p>
              </div>
              <RefreshStatusBadge status={table.refreshStatus} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dash-border pt-3">
              <div>
                <p className="text-[10px] uppercase text-zinc-500">
                  Refresh Mode
                </p>
                <p className="text-xs font-medium text-zinc-300">
                  {table.refreshMode}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Freshness</p>
                <p className="text-xs font-medium text-zinc-300">
                  {table.freshness}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-dash-border pt-3">
              <p className="text-[10px] uppercase text-zinc-500 mb-1">
                Defining Query
              </p>
              <pre className="rounded bg-[#1a1b26] p-2 text-[10px] text-zinc-400 overflow-x-auto">
                {table.definingQuery}
              </pre>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <PropsTable props={refreshStatusBadgeProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/materialized-tables")({
  component: MaterializedTablesDomainPage,
})
