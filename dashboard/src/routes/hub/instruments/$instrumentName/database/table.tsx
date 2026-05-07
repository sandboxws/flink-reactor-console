/**
 * Hub database table detail — /hub/instruments/$instrumentName/database/table.
 *
 * Reads `?schema=...&table=...` and shows the table's columns, indexes,
 * and constraints from the `databaseTable` query.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import {
  createFileRoute,
  Link,
  useParams,
  useSearch,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { gql } from "urql"
import { graphqlClient } from "@/lib/graphql-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { DatabaseSubTabs } from "./index"

interface DbColumn {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  comment: string | null
}

interface DbIndex {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

interface DbConstraint {
  name: string
  type: string
  columns: string[]
  refTable: string | null
  refColumns: string[]
}

interface DbTable {
  name: string
  schema: string
  columns: DbColumn[]
  indexes: DbIndex[]
  constraints: DbConstraint[]
}

const TABLE_QUERY = gql`
  query DatabaseTable(
    $instrument: String!
    $schema: String!
    $table: String!
  ) {
    databaseTable(instrument: $instrument, schema: $schema, table: $table) {
      name
      schema
      columns {
        name
        dataType
        nullable
        defaultValue
        isPrimaryKey
        comment
      }
      indexes {
        name
        columns
        unique
        type
      }
      constraints {
        name
        type
        columns
        refTable
        refColumns
      }
    }
  }
`

interface TableSearch {
  schema?: string
  table?: string
}

function HubDatabaseTable() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/database/table",
  })
  const { schema, table } = useSearch({
    from: "/hub/instruments/$instrumentName/database/table",
  })
  const [meta, setMeta] = useState<DbTable | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!schema || !table) return
    let cancelled = false
    setMeta(null)
    graphqlClient
      .query(TABLE_QUERY, { instrument: instrumentName, schema, table })
      .toPromise()
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
        } else {
          setMeta(res.data?.databaseTable)
          setError(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrumentName, schema, table])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Database",
            to: "/hub/instruments/$instrumentName/database".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: table ?? "(pick a table)" },
        ]}
        LinkComponent={HubLink}
      />
      <DatabaseSubTabs instrument={instrumentName} active="table" />

      <div className="mt-5">
        {!schema || !table ? (
          <p className="text-[12px] font-mono text-fg-faint">
            Pick a table from the overview tab.
          </p>
        ) : error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : !meta ? (
          <p className="text-[11.5px] font-mono text-fg-faint">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="glass-card-static overflow-hidden">
              <div className="flex items-center justify-between border-b border-dash-border px-4 py-2">
                <h3 className="font-mono text-[13px] text-zinc-100">
                  {meta.schema}.{meta.name}
                </h3>
                <Link
                  to="/hub/instruments/$instrumentName/database/query"
                  params={{ instrumentName }}
                  search={{
                    sql: `SELECT * FROM ${meta.schema}.${meta.name} LIMIT 100`,
                  }}
                  className="text-[11px] text-fr-coral hover:underline"
                >
                  Query this table →
                </Link>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-dash-border text-left text-fg-faint">
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Column
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Null
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Default
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Comment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border/40">
                  {meta.columns.map((c) => (
                    <tr key={c.name} className="hover:bg-dash-elevated/30">
                      <td className="px-4 py-2 font-mono text-fg">
                        {c.name}
                        {c.isPrimaryKey ? (
                          <span className="ml-1 font-mono text-[9px] text-fr-coral">
                            PK
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {c.dataType}
                      </td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {c.nullable ? "yes" : "no"}
                      </td>
                      <td className="px-4 py-2 font-mono text-[11px] text-fg-muted truncate max-w-[160px]">
                        {c.defaultValue ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-[11.5px] text-fg-muted truncate max-w-[200px]">
                        {c.comment ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta.indexes.length > 0 ? (
              <div className="glass-card-static p-4">
                <h3 className="section-heading mb-3">Indexes</h3>
                <ul className="space-y-1.5 text-[12px]">
                  {meta.indexes.map((i) => (
                    <li
                      key={i.name}
                      className="flex flex-wrap items-center gap-2 font-mono text-fg-muted"
                    >
                      <span className="text-fg">{i.name}</span>
                      <span className="prop-chip">{i.type}</span>
                      {i.unique ? (
                        <span className="prop-chip">unique</span>
                      ) : null}
                      <span className="text-fg-faint">on</span>
                      <span className="text-fg">{i.columns.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {meta.constraints.length > 0 ? (
              <div className="glass-card-static p-4">
                <h3 className="section-heading mb-3">Constraints</h3>
                <ul className="space-y-1.5 text-[12px]">
                  {meta.constraints.map((c) => (
                    <li key={c.name} className="font-mono text-fg-muted">
                      <span className="text-fg">{c.name}</span>{" "}
                      <span className="prop-chip">{c.type}</span>{" "}
                      <span className="text-fg-faint">on</span>{" "}
                      <span className="text-fg">{c.columns.join(", ")}</span>
                      {c.refTable ? (
                        <>
                          {" "}
                          <span className="text-fg-faint">→</span>{" "}
                          <span className="text-fg">
                            {c.refTable}({c.refColumns.join(", ")})
                          </span>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/database/table",
)({
  validateSearch: (search: Record<string, unknown>): TableSearch => ({
    schema: typeof search.schema === "string" ? search.schema : undefined,
    table: typeof search.table === "string" ? search.table : undefined,
  }),
  component: HubDatabaseTable,
})
