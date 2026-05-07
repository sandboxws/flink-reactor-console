/**
 * Hub Fluss table detail — /hub/instruments/$instrumentName/fluss/table.
 *
 * Reads `?database=...&table=...` and renders the table's full schema +
 * connector properties. Falls back to a "pick a table" message when the
 * search params are missing.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { format } from "date-fns"
import { useEffect, useState } from "react"
import { gql } from "urql"
import { graphqlClient } from "@/lib/graphql-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { FlussSubTabs } from "./index"

interface FlussField {
  name: string
  type: string
  nullable: boolean
  comment: string
}

interface FlussTableMetadata {
  database: string
  name: string
  tableType: string
  bucketCount: number
  bucketKey: string[]
  primaryKey: string[]
  schema: FlussField[]
  properties: Record<string, unknown>
  comment: string
  lastUpdatedMs: number
}

const FLUSS_TABLE_QUERY = gql`
  query FlussTable(
    $instrument: String!
    $database: String!
    $table: String!
  ) {
    flussTable(instrument: $instrument, database: $database, table: $table) {
      database
      name
      tableType
      bucketCount
      bucketKey
      primaryKey
      schema {
        name
        type
        nullable
        comment
      }
      properties
      comment
      lastUpdatedMs
    }
  }
`

interface FlussTableSearch {
  database?: string
  table?: string
}

function HubFlussTable() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/fluss/table",
  })
  const { database, table } = useSearch({
    from: "/hub/instruments/$instrumentName/fluss/table",
  })
  const [meta, setMeta] = useState<FlussTableMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!database || !table) return
    let cancelled = false
    setMeta(null)
    graphqlClient
      .query(FLUSS_TABLE_QUERY, {
        instrument: instrumentName,
        database,
        table,
      })
      .toPromise()
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
        } else {
          setMeta(res.data?.flussTable)
          setError(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrumentName, database, table])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Fluss",
            to: "/hub/instruments/$instrumentName/fluss".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: table ?? "(pick a table)" },
        ]}
        LinkComponent={HubLink}
      />
      <FlussSubTabs instrument={instrumentName} active="table" />

      <div className="mt-5">
        {!database || !table ? (
          <p className="text-[12px] font-mono text-fg-faint">
            Pick a table from the overview tab.
          </p>
        ) : error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : !meta ? (
          <p className="text-[11.5px] font-mono text-fg-faint">Loading…</p>
        ) : (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <div className="glass-card-static overflow-hidden">
                <div className="border-b border-dash-border px-4 py-2">
                  <h3 className="font-sans text-[13.5px] font-medium text-zinc-100">
                    {meta.database}.{meta.name}
                    <span className="ml-2 font-mono text-[10px] text-fg-faint">
                      {meta.tableType}
                    </span>
                  </h3>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-dash-border text-left text-fg-faint">
                      <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                        Field
                      </th>
                      <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                        Null
                      </th>
                      <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                        Comment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-border/40">
                    {meta.schema.map((f) => (
                      <tr key={f.name} className="hover:bg-dash-elevated/30">
                        <td className="px-4 py-2 font-mono text-fg">
                          {f.name}
                          {meta.primaryKey.includes(f.name) ? (
                            <span className="ml-1 font-mono text-[9px] text-fr-coral">
                              PK
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 font-mono text-fg-muted">
                          {f.type}
                        </td>
                        <td className="px-4 py-2 font-mono text-fg-muted">
                          {f.nullable ? "yes" : "no"}
                        </td>
                        <td className="px-4 py-2 text-[11.5px] text-fg-muted">
                          {f.comment || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <aside className="col-span-12 space-y-4 lg:col-span-4">
              <div className="glass-card-static p-4">
                <h3 className="section-heading mb-3">Properties</h3>
                <dl className="space-y-1.5 text-[12px]">
                  <Row label="Buckets" value={String(meta.bucketCount)} />
                  <Row
                    label="Bucket key"
                    value={
                      meta.bucketKey.length ? meta.bucketKey.join(", ") : "—"
                    }
                  />
                  <Row
                    label="Updated"
                    value={
                      meta.lastUpdatedMs
                        ? format(new Date(meta.lastUpdatedMs), "PP p")
                        : "—"
                    }
                  />
                </dl>
              </div>
              <div className="glass-card-static p-4">
                <h3 className="section-heading mb-3">Connector props</h3>
                {Object.keys(meta.properties).length === 0 ? (
                  <p className="text-[11.5px] text-fg-muted">No properties.</p>
                ) : (
                  <dl className="space-y-1.5 text-[11.5px]">
                    {Object.entries(meta.properties).map(([k, v]) => (
                      <Row key={k} label={k} value={String(v)} />
                    ))}
                  </dl>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </HubAppShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-mono text-fg truncate">{value}</dd>
    </div>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/fluss/table",
)({
  validateSearch: (search: Record<string, unknown>): FlussTableSearch => ({
    database: typeof search.database === "string" ? search.database : undefined,
    table: typeof search.table === "string" ? search.table : undefined,
  }),
  component: HubFlussTable,
})
