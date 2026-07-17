/**
 * KafkaConsumerGroupDetail — a single Kafka consumer group.
 *
 * Group header (state, protocol, members), a members list with their
 * partition assignments, and a per-partition offset table showing
 * committed vs end offset and lag. Lag > 0 is tinted to signal the group
 * is behind.
 */

import { KpiCard, SevBadge } from "@flink-reactor/ui"
import { useEffect, useMemo, useState } from "react"
import {
  fetchKafkaConsumerGroup,
  type KafkaConsumerGroupDetail as KafkaConsumerGroupDetailData,
} from "@/lib/instruments-data"
import { groupStateTone } from "./kafka-derive"

interface KafkaConsumerGroupDetailProps {
  instrument: string
  groupId: string
}

export function KafkaConsumerGroupDetail({
  instrument,
  groupId,
}: KafkaConsumerGroupDetailProps) {
  const [detail, setDetail] = useState<KafkaConsumerGroupDetailData | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    fetchKafkaConsumerGroup(instrument, groupId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load group")
      })
    return () => {
      cancelled = true
    }
  }, [instrument, groupId])

  const totalLag = useMemo(
    () => (detail?.offsets ?? []).reduce((sum, o) => sum + o.lag, 0),
    [detail],
  )

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
          {detail.groupId}
        </h2>
        <SevBadge tone={groupStateTone(detail.state)}>{detail.state}</SevBadge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Members" value={detail.members.length} />
        <KpiCard
          label="Total lag"
          value={totalLag.toLocaleString()}
          sub={totalLag > 0 ? "behind" : "caught up"}
        />
        <KpiCard label="Protocol" value={detail.protocol || "—"} />
        <KpiCard label="Protocol type" value={detail.protocolType || "—"} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 lg:col-span-7">
          <div className="glass-card-static overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <h3 className="section-heading">Offsets</h3>
            </div>
            {detail.offsets.length === 0 ? (
              <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
                No committed offsets.
              </p>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-dash-border text-left text-fg-faint">
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Topic
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Part.
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Committed
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      End
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Lag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border/40">
                  {detail.offsets.map((o) => (
                    <tr
                      key={`${o.topic}/${o.partition}`}
                      className="hover:bg-dash-elevated/30"
                    >
                      <td className="px-4 py-2 font-mono text-fg truncate max-w-[220px]">
                        {o.topic}
                      </td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {o.partition}
                      </td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {o.committedOffset.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-mono text-fg-muted">
                        {o.endOffset.toLocaleString()}
                      </td>
                      <td
                        className={
                          "px-4 py-2 font-mono " +
                          (o.lag > 0 ? "text-fr-amber" : "text-fg-muted")
                        }
                      >
                        {o.lag.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-5">
          <div className="glass-card-static overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <h3 className="section-heading">Members</h3>
            </div>
            {detail.members.length === 0 ? (
              <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
                No active members.
              </p>
            ) : (
              <ul className="divide-y divide-dash-border/40">
                {detail.members.map((m) => (
                  <li key={m.clientId} className="px-4 py-2.5">
                    <div className="font-mono text-[12px] text-fg">
                      {m.clientId}
                    </div>
                    <div className="font-mono text-[10.5px] text-fg-faint">
                      {m.clientHost} · {m.assignments.length} partition
                      {m.assignments.length === 1 ? "" : "s"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
