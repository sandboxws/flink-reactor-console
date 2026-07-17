/**
 * Pure derivations for the Kafka instrument browser.
 *
 * The Kafka GraphQL surface is read-only, so every summary value the UI
 * shows (KPI strip, broker topology, under-replication) is computed
 * client-side from the topic / consumer-group / partition lists. Keeping
 * these as pure functions makes them unit-testable and shared across the
 * browser and the detail views.
 */

import type {
  KafkaConsumerGroup,
  KafkaPartition,
  KafkaTopic,
} from "@/lib/instruments-data"

export type KafkaGroupTone = "ok" | "warn" | "fail" | "muted"

/** Map a Kafka consumer-group state to a SevBadge tone. */
export function groupStateTone(state: string): KafkaGroupTone {
  switch (state) {
    case "Stable":
      return "ok"
    case "Empty":
    case "Dead":
      return "muted"
    case "PreparingRebalance":
    case "CompletingRebalance":
      return "warn"
    default:
      return "muted"
  }
}

export interface KafkaTopicKpis {
  topics: number
  partitions: number
  groups: number
  totalLag: number
  internal: number
}

/** Derive the topic-browser KPI strip from the topic + group lists. */
export function topicKpis(
  topics: KafkaTopic[],
  groups: KafkaConsumerGroup[],
): KafkaTopicKpis {
  return {
    topics: topics.length,
    partitions: topics.reduce((sum, t) => sum + t.partitionCount, 0),
    groups: groups.length,
    totalLag: groups.reduce((sum, g) => sum + g.totalLag, 0),
    internal: topics.filter((t) => t.internal).length,
  }
}

/** A partition is under-replicated when its ISR set is smaller than its replica set. */
export function isUnderReplicated(p: KafkaPartition): boolean {
  return p.inSyncReplicas.length < p.replicas.length
}

/** Count under-replicated partitions in a topic. */
export function underReplicatedCount(partitions: KafkaPartition[]): number {
  return partitions.filter(isUnderReplicated).length
}

/**
 * Distinct broker ids observed across partition leaders and replicas.
 * The Kafka GraphQL surface exposes no bootstrap/broker list, so this is
 * the only broker-topology signal available.
 */
export function brokersSeen(partitions: KafkaPartition[]): number[] {
  const ids = new Set<number>()
  for (const p of partitions) {
    ids.add(p.leader)
    for (const r of p.replicas) ids.add(r)
  }
  return [...ids].sort((a, b) => a - b)
}
