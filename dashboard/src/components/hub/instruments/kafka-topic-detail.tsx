/**
 * KafkaTopicDetail — a single Kafka topic.
 *
 * Partition table (leader, replicas, in-sync replicas) with an
 * under-replicated flag, the topic's config entries, and a "brokers seen"
 * topology summary derived from partition leader/replica ids (the Kafka
 * GraphQL surface exposes no bootstrap/connection config).
 */

import { KpiCard, SevBadge } from "@flink-reactor/ui"
import { useEffect, useMemo, useState } from "react"
import {
  fetchKafkaTopic,
  type KafkaTopicDetail as KafkaTopicDetailData,
} from "@/lib/instruments-data"
import {
  brokersSeen,
  isUnderReplicated,
  underReplicatedCount,
} from "./kafka-derive"

interface KafkaTopicDetailProps {
  instrument: string
  topicName: string
}

export function KafkaTopicDetail({
  instrument,
  topicName,
}: KafkaTopicDetailProps) {
  const [detail, setDetail] = useState<KafkaTopicDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    fetchKafkaTopic(instrument, topicName)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load topic")
      })
    return () => {
      cancelled = true
    }
  }, [instrument, topicName])

  const underReplicated = useMemo(
    () => underReplicatedCount(detail?.partitions ?? []),
    [detail],
  )

  const brokers = useMemo(() => brokersSeen(detail?.partitions ?? []), [detail])

  if (error) {
    return <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
  }
  if (!detail) {
    return <p className="text-[11.5px] font-mono text-fg-faint">Loading…</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="font-sans text-[16px] font-semibold text-zinc-100">
          {detail.name}
        </h2>
        {detail.internal ? <SevBadge tone="muted">internal</SevBadge> : null}
        {underReplicated > 0 ? (
          <SevBadge tone="warn">{underReplicated} under-replicated</SevBadge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Partitions" value={detail.partitionCount} />
        <KpiCard label="Replication" value={detail.replicationFactor} />
        <KpiCard
          label="Messages"
          value={detail.messageCount.toLocaleString()}
        />
        <KpiCard label="Brokers seen" value={brokers.length} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 lg:col-span-8">
          <div className="glass-card-static overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <h3 className="section-heading">Partitions</h3>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-dash-border text-left text-fg-faint">
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Partition
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Leader
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Replicas
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    In-sync
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border/40">
                {detail.partitions.map((p) => {
                  const under = isUnderReplicated(p)
                  return (
                    <tr key={p.id} className="hover:bg-dash-elevated/30">
                      <td className="px-4 py-2 font-mono text-fg">{p.id}</td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {p.leader}
                      </td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {p.replicas.join(", ")}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            "font-mono " +
                            (under ? "text-fr-amber" : "text-fg-muted")
                          }
                        >
                          {p.inSyncReplicas.join(", ") || "—"}
                        </span>
                        {under ? (
                          <SevBadge tone="warn" className="ml-2">
                            under-replicated
                          </SevBadge>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-4">
          <div className="glass-card-static p-4">
            <h3 className="section-heading mb-3">Brokers seen</h3>
            {brokers.length === 0 ? (
              <p className="text-[11.5px] text-fg-muted">No partitions.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {brokers.map((b) => (
                  <span
                    key={b}
                    className="font-mono text-[11px] rounded bg-dash-elevated px-1.5 py-0.5 text-fg-muted"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-fg-faint">
              Derived from partition leaders and replicas.
            </p>
          </div>

          <div className="glass-card-static p-4">
            <h3 className="section-heading mb-3">Config</h3>
            {detail.configEntries.length === 0 ? (
              <p className="text-[11.5px] text-fg-muted">No config entries.</p>
            ) : (
              <dl className="space-y-1.5 text-[11.5px]">
                {detail.configEntries.map((c) => (
                  <div key={c.key} className="flex justify-between gap-3">
                    <dt className="text-fg-muted truncate">{c.key}</dt>
                    <dd className="font-mono text-fg truncate max-w-[55%] text-right">
                      {c.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
