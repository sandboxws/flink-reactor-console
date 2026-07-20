/**
 * KafkaTopicBrowser — Kafka instrument landing browser.
 *
 * A KPI strip derived client-side from the topic + consumer-group lists,
 * then client-side tabs switching between the topics table and the
 * consumer-groups table. Clicking a row deep-links to the topic or
 * consumer-group detail route.
 *
 * The Kafka GraphQL surface is read-only and exposes no throughput/rate
 * metrics, so there are deliberately no sparklines here — the KPI strip
 * and the consumer-group lag carry the signal.
 */

import { KpiCard, SevBadge } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchKafkaConsumerGroups,
  fetchKafkaTopics,
  type KafkaConsumerGroup,
  type KafkaTopic,
} from "@/lib/instruments-data"
import { useInstrumentStore } from "@/stores/instruments-store"
import { groupStateTone, topicKpis } from "./kafka-derive"
import { KafkaSeedDialog } from "./kafka-seed-dialog"

interface KafkaTopicBrowserProps {
  instrument: string
}

type BrowserTab = "topics" | "groups"

export function KafkaTopicBrowser({ instrument }: KafkaTopicBrowserProps) {
  const [topics, setTopics] = useState<KafkaTopic[] | null>(null)
  const [groups, setGroups] = useState<KafkaConsumerGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<BrowserTab>("topics")

  const fetchInstruments = useInstrumentStore((s) => s.fetchInstruments)
  const canSeed = useInstrumentStore(
    (s) =>
      s.instruments
        .find((i) => i.name === instrument)
        ?.capabilities.includes("seed") ?? false,
  )
  useEffect(() => {
    void fetchInstruments()
  }, [fetchInstruments])

  // Load topics + consumer groups. The returned cleanup cancels in-flight
  // state updates when the instrument changes; also invoked after a seed run
  // to refetch the (now larger) topic list.
  const loadKafkaData = useCallback(() => {
    let cancelled = false
    setTopics(null)
    setGroups(null)
    Promise.all([
      fetchKafkaTopics(instrument),
      fetchKafkaConsumerGroups(instrument),
    ])
      .then(([topicList, groupList]) => {
        if (cancelled) return
        setTopics(topicList)
        setGroups(groupList)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        // Keep any previously loaded data visible; surface the error only.
        setError(e instanceof Error ? e.message : "Failed to load Kafka data")
        setTopics((prev) => prev ?? [])
        setGroups((prev) => prev ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [instrument])

  useEffect(() => loadKafkaData(), [loadKafkaData])

  const kpis = useMemo(
    () => topicKpis(topics ?? [], groups ?? []),
    [topics, groups],
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Topics" value={kpis.topics} />
        <KpiCard label="Partitions" value={kpis.partitions} />
        <KpiCard label="Consumer groups" value={kpis.groups} />
        <KpiCard
          label="Total lag"
          value={kpis.totalLag.toLocaleString()}
          sub={kpis.totalLag > 0 ? "behind" : "caught up"}
        />
        <KpiCard label="Internal" value={kpis.internal} />
      </div>

      {error ? (
        <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
      ) : null}

      <div className="flex items-center justify-between border-b border-dash-border">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("topics")}
            className={`tab ${tab === "topics" ? "active" : ""}`}
          >
            Topics
            {topics ? <span className="tab-count">{topics.length}</span> : null}
          </button>
          <button
            type="button"
            onClick={() => setTab("groups")}
            className={`tab ${tab === "groups" ? "active" : ""}`}
          >
            Consumer groups
            {groups ? <span className="tab-count">{groups.length}</span> : null}
          </button>
        </div>
        {canSeed ? (
          <KafkaSeedDialog
            instrument={instrument}
            onSeeded={() => {
              loadKafkaData()
            }}
          />
        ) : null}
      </div>

      {tab === "topics" ? (
        <TopicsTable instrument={instrument} topics={topics} />
      ) : (
        <GroupsTable instrument={instrument} groups={groups} />
      )}
    </div>
  )
}

function TopicsTable({
  instrument,
  topics,
}: {
  instrument: string
  topics: KafkaTopic[] | null
}) {
  return (
    <div className="glass-card-static overflow-hidden">
      {topics === null ? (
        <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
          Loading topics…
        </p>
      ) : topics.length === 0 ? (
        <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
          No topics on this cluster.
        </p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-dash-border text-left text-fg-faint">
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Partitions
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Replication
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Kind
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border/40">
            {topics.map((t) => (
              <tr key={t.name} className="hover:bg-dash-elevated/30">
                <td className="px-4 py-2 font-mono text-fg">
                  <Link
                    to="/hub/instruments/$instrumentName/kafka/topic"
                    params={{ instrumentName: instrument }}
                    search={{ name: t.name }}
                    className="text-fr-coral hover:underline"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-fg-muted">
                  {t.partitionCount}
                </td>
                <td className="px-4 py-2 font-mono text-fg-muted">
                  {t.replicationFactor}
                </td>
                <td className="px-4 py-2">
                  {t.internal ? (
                    <SevBadge tone="muted">internal</SevBadge>
                  ) : (
                    <span className="font-mono text-[10.5px] text-fg-faint">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function GroupsTable({
  instrument,
  groups,
}: {
  instrument: string
  groups: KafkaConsumerGroup[] | null
}) {
  return (
    <div className="glass-card-static overflow-hidden">
      {groups === null ? (
        <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
          Loading consumer groups…
        </p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
          No consumer groups.
        </p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-dash-border text-left text-fg-faint">
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Group
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                State
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Members
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Lag
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border/40">
            {groups.map((g) => (
              <tr key={g.groupId} className="hover:bg-dash-elevated/30">
                <td className="px-4 py-2 font-mono text-fg">
                  <Link
                    to="/hub/instruments/$instrumentName/kafka/consumer-group"
                    params={{ instrumentName: instrument }}
                    search={{ groupId: g.groupId }}
                    className="text-fr-coral hover:underline"
                  >
                    {g.groupId}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <SevBadge tone={groupStateTone(g.state)}>{g.state}</SevBadge>
                </td>
                <td className="px-4 py-2 font-mono text-fg-muted">
                  {g.memberCount}
                </td>
                <td
                  className={
                    "px-4 py-2 font-mono " +
                    (g.totalLag > 0 ? "text-fr-amber" : "text-fg-muted")
                  }
                >
                  {g.totalLag.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
