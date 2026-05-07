/**
 * Hub Database instrument index — /hub/instruments/$instrumentName/database.
 *
 * Renders schemas and their tables. Click a table to drill into the
 * detail route; jump to the query editor via the tabs row.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { Database, HardDrive } from "lucide-react"
import { useEffect, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import {
  type DatabaseSchema,
  type DatabaseTableSummary,
  fetchDatabaseSchemas,
  fetchDatabaseTables,
} from "@/lib/instruments-data"

function HubDatabaseIndex() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/database/",
  })
  const [schemas, setSchemas] = useState<DatabaseSchema[] | null>(null)
  const [activeSchema, setActiveSchema] = useState<string | null>(null)
  const [tables, setTables] = useState<DatabaseTableSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchDatabaseSchemas(instrumentName)
      .then((list) => {
        if (cancelled) return
        setSchemas(list)
        if (list.length > 0) setActiveSchema(list[0].name)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load schemas")
          setSchemas([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrumentName])

  useEffect(() => {
    if (!activeSchema) {
      setTables([])
      return
    }
    let cancelled = false
    setTables(null)
    fetchDatabaseTables(instrumentName, activeSchema)
      .then((list) => {
        if (!cancelled) setTables(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load tables")
          setTables([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrumentName, activeSchema])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Database" },
        ]}
        LinkComponent={HubLink}
      />
      <DatabaseSubTabs instrument={instrumentName} active="overview" />

      <div className="mt-5">
        {error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : null}
        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 lg:col-span-3">
            <div className="glass-card-static p-4">
              <h3 className="section-heading mb-3">Schemas</h3>
              {schemas === null ? (
                <p className="text-[11px] font-mono text-fg-faint">Loading…</p>
              ) : schemas.length === 0 ? (
                <p className="text-[11px] font-mono text-fg-faint">
                  No schemas.
                </p>
              ) : (
                <ul className="space-y-1">
                  {schemas.map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        onClick={() => setActiveSchema(s.name)}
                        className={
                          "file-tree-row w-full text-left " +
                          (s.name === activeSchema ? "active" : "")
                        }
                      >
                        <Database className="size-3.5 text-fr-coral" />
                        <span className="font-mono text-[12px] truncate">
                          {s.name}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-fg-faint">
                          {s.tableCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-9">
            <div className="glass-card-static overflow-hidden">
              <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
                <h3 className="section-heading">
                  Tables{" "}
                  {activeSchema ? (
                    <span className="text-fg">· {activeSchema}</span>
                  ) : null}
                </h3>
              </div>
              {tables === null ? (
                <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
                  Loading…
                </p>
              ) : tables.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <HardDrive className="mx-auto size-6 text-fr-coral/50" />
                  <p className="mt-2 text-[12px] text-fg-muted">
                    No tables in this schema.
                  </p>
                </div>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-dash-border text-left text-fg-faint">
                      <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-wider">
                        Rows (est.)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-border/40">
                    {tables.map((t) => (
                      <tr key={t.name} className="hover:bg-dash-elevated/30">
                        <td className="px-4 py-2 font-mono">
                          <Link
                            to="/hub/instruments/$instrumentName/database/table"
                            params={{ instrumentName }}
                            search={{ schema: t.schema, table: t.name }}
                            className="text-fr-coral hover:underline"
                          >
                            {t.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 font-mono text-fg-muted">
                          {t.type}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-fg-muted">
                          {t.rowCountEstimate.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </HubAppShell>
  )
}

interface DatabaseSubTabsProps {
  instrument: string
  active: "overview" | "query" | "table"
}

export function DatabaseSubTabs({ instrument, active }: DatabaseSubTabsProps) {
  return (
    <div className="mt-3 flex items-center gap-1 border-b border-dash-border">
      <Link
        to="/hub/instruments/$instrumentName/database"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "overview" ? "active" : ""}`}
      >
        Overview
      </Link>
      <Link
        to="/hub/instruments/$instrumentName/database/query"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "query" ? "active" : ""}`}
      >
        Query
      </Link>
      {active === "table" ? <span className="tab active">Table</span> : null}
    </div>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/database/",
)({
  component: HubDatabaseIndex,
})
