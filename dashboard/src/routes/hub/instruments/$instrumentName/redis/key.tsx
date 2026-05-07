/**
 * Hub Redis key detail — /hub/instruments/$instrumentName/redis/key.
 *
 * Reads `?key=...` and shows the type/encoding/ttl plus a value preview.
 * String/list/set values render as a code block; hashes/zsets render as
 * tables.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { gql } from "urql"
import { graphqlClient } from "@/lib/graphql-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { RedisSubTabs } from "./index"

interface RedisKeyInfo {
  key: string
  type: string
  ttl: number
  encoding: string
  memoryUsage: number
}

interface RedisKeyValue {
  key: string
  type: string
  stringValue: string | null
  hashValue: { field: string; value: string }[] | null
  listValue: string[] | null
  setValue: string[] | null
  zsetValue: { member: string; score: number }[] | null
  truncated: boolean
  totalSize: number
}

const KEY_INFO_QUERY = gql`
  query RedisKeyInfo($instrument: String!, $key: String!) {
    redisKeyInfo(instrument: $instrument, key: $key) {
      key type ttl encoding memoryUsage
    }
  }
`

const KEY_VALUE_QUERY = gql`
  query RedisKeyValue($instrument: String!, $key: String!) {
    redisKeyValue(instrument: $instrument, key: $key) {
      key
      type
      stringValue
      hashValue { field value }
      listValue
      setValue
      zsetValue { member score }
      truncated
      totalSize
    }
  }
`

interface RedisKeySearch {
  key?: string
}

function HubRedisKey() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/redis/key",
  })
  const { key } = useSearch({
    from: "/hub/instruments/$instrumentName/redis/key",
  })
  const [info, setInfo] = useState<RedisKeyInfo | null>(null)
  const [value, setValue] = useState<RedisKeyValue | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    setInfo(null)
    setValue(null)
    Promise.all([
      graphqlClient
        .query(KEY_INFO_QUERY, { instrument: instrumentName, key })
        .toPromise(),
      graphqlClient
        .query(KEY_VALUE_QUERY, { instrument: instrumentName, key })
        .toPromise(),
    ]).then(([infoRes, valueRes]) => {
      if (cancelled) return
      if (infoRes.error || valueRes.error) {
        setError(
          infoRes.error?.message ?? valueRes.error?.message ?? "Failed to load",
        )
      } else {
        setInfo(infoRes.data?.redisKeyInfo)
        setValue(valueRes.data?.redisKeyValue)
        setError(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [instrumentName, key])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Redis",
            to: "/hub/instruments/$instrumentName/redis".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: key ?? "(pick a key)", mono: true },
        ]}
        LinkComponent={HubLink}
      />
      <RedisSubTabs instrument={instrumentName} active="key" />

      <div className="mt-5">
        {!key ? (
          <p className="text-[12px] font-mono text-fg-faint">
            Pick a key from the keys tab.
          </p>
        ) : error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : !value || !info ? (
          <p className="text-[11.5px] font-mono text-fg-faint">Loading…</p>
        ) : (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <div className="glass-card-static overflow-hidden">
                <div className="border-b border-dash-border px-4 py-2">
                  <h3 className="font-mono text-[12px] text-zinc-100 truncate">
                    {value.key}
                  </h3>
                </div>
                <div className="p-4">
                  <ValueRenderer value={value} />
                </div>
              </div>
            </div>
            <aside className="col-span-12 lg:col-span-4">
              <div className="glass-card-static p-4">
                <h3 className="section-heading mb-3">Key info</h3>
                <dl className="space-y-1.5 text-[12px]">
                  <Row label="Type" value={info.type} />
                  <Row label="Encoding" value={info.encoding} />
                  <Row
                    label="TTL"
                    value={info.ttl < 0 ? "no expiry" : `${info.ttl}s`}
                  />
                  <Row
                    label="Memory"
                    value={`${info.memoryUsage.toLocaleString()} bytes`}
                  />
                  <Row label="Total size" value={`${value.totalSize}`} />
                  {value.truncated ? (
                    <Row label="Note" value="value truncated" />
                  ) : null}
                </dl>
              </div>
            </aside>
          </div>
        )}
      </div>
    </HubAppShell>
  )
}

function ValueRenderer({ value }: { value: RedisKeyValue }) {
  if (value.stringValue !== null) {
    return (
      <pre className="overflow-x-auto rounded-md border border-dash-border bg-dash-surface p-3 font-mono text-[11.5px] text-fg whitespace-pre-wrap break-all">
        {value.stringValue}
      </pre>
    )
  }
  if (value.hashValue) {
    return (
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-dash-border text-left text-fg-faint">
            <th className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
              Field
            </th>
            <th className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border/40">
          {value.hashValue.map((h) => (
            <tr key={h.field}>
              <td className="px-2 py-1 font-mono text-fg-muted">{h.field}</td>
              <td className="px-2 py-1 font-mono text-fg break-all">
                {h.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  if (value.listValue) {
    return (
      <ol className="list-decimal pl-6 font-mono text-[11.5px] text-fg space-y-1">
        {value.listValue.map((v, i) => (
          <li key={i} className="break-all">
            {v}
          </li>
        ))}
      </ol>
    )
  }
  if (value.setValue) {
    return (
      <ul className="list-disc pl-6 font-mono text-[11.5px] text-fg space-y-1">
        {value.setValue.map((v, i) => (
          <li key={i} className="break-all">
            {v}
          </li>
        ))}
      </ul>
    )
  }
  if (value.zsetValue) {
    return (
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-dash-border text-left text-fg-faint">
            <th className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
              Member
            </th>
            <th className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border/40">
          {value.zsetValue.map((z) => (
            <tr key={z.member}>
              <td className="px-2 py-1 font-mono text-fg-muted">{z.member}</td>
              <td className="px-2 py-1 font-mono text-fg">{z.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  return <p className="text-[12px] text-fg-muted">No value preview.</p>
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
  "/hub/instruments/$instrumentName/redis/key",
)({
  validateSearch: (search: Record<string, unknown>): RedisKeySearch => ({
    key: typeof search.key === "string" ? search.key : undefined,
  }),
  component: HubRedisKey,
})
