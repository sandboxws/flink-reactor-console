import { describe, expect, it } from "vitest"
import type {
  KafkaConsumerGroup,
  KafkaPartition,
  KafkaTopic,
} from "@/lib/instruments-data"
import {
  brokersSeen,
  groupStateTone,
  isUnderReplicated,
  topicKpis,
  underReplicatedCount,
} from "./kafka-derive"

function topic(over: Partial<KafkaTopic>): KafkaTopic {
  return {
    name: "t",
    partitionCount: 1,
    replicationFactor: 1,
    internal: false,
    ...over,
  }
}

function group(over: Partial<KafkaConsumerGroup>): KafkaConsumerGroup {
  return { groupId: "g", state: "Stable", memberCount: 0, totalLag: 0, ...over }
}

function partition(over: Partial<KafkaPartition>): KafkaPartition {
  return { id: 0, leader: 1, replicas: [1], inSyncReplicas: [1], ...over }
}

describe("groupStateTone", () => {
  it("maps known states", () => {
    expect(groupStateTone("Stable")).toBe("ok")
    expect(groupStateTone("Empty")).toBe("muted")
    expect(groupStateTone("Dead")).toBe("muted")
    expect(groupStateTone("PreparingRebalance")).toBe("warn")
    expect(groupStateTone("CompletingRebalance")).toBe("warn")
  })

  it("defaults unknown states to muted", () => {
    expect(groupStateTone("SomethingElse")).toBe("muted")
    expect(groupStateTone("")).toBe("muted")
  })
})

describe("topicKpis", () => {
  it("derives counts and sums", () => {
    const topics = [
      topic({ name: "a", partitionCount: 3, internal: false }),
      topic({ name: "b", partitionCount: 5, internal: false }),
      topic({ name: "__consumer_offsets", partitionCount: 50, internal: true }),
    ]
    const groups = [
      group({ groupId: "g1", totalLag: 10 }),
      group({ groupId: "g2", totalLag: 0 }),
    ]
    expect(topicKpis(topics, groups)).toEqual({
      topics: 3,
      partitions: 58,
      groups: 2,
      totalLag: 10,
      internal: 1,
    })
  })

  it("handles empty inputs", () => {
    expect(topicKpis([], [])).toEqual({
      topics: 0,
      partitions: 0,
      groups: 0,
      totalLag: 0,
      internal: 0,
    })
  })
})

describe("under-replication", () => {
  it("flags a partition with fewer in-sync replicas than replicas", () => {
    expect(
      isUnderReplicated(
        partition({ replicas: [1, 2, 3], inSyncReplicas: [1, 2] }),
      ),
    ).toBe(true)
    expect(
      isUnderReplicated(
        partition({ replicas: [1, 2, 3], inSyncReplicas: [1, 2, 3] }),
      ),
    ).toBe(false)
  })

  it("counts under-replicated partitions", () => {
    const parts = [
      partition({ id: 0, replicas: [1, 2], inSyncReplicas: [1, 2] }),
      partition({ id: 1, replicas: [1, 2], inSyncReplicas: [1] }),
      partition({ id: 2, replicas: [1, 2, 3], inSyncReplicas: [1] }),
    ]
    expect(underReplicatedCount(parts)).toBe(2)
  })
})

describe("brokersSeen", () => {
  it("returns distinct broker ids sorted, from leaders and replicas", () => {
    const parts = [
      partition({ id: 0, leader: 2, replicas: [2, 3] }),
      partition({ id: 1, leader: 1, replicas: [1, 3] }),
    ]
    expect(brokersSeen(parts)).toEqual([1, 2, 3])
  })

  it("returns an empty array for no partitions", () => {
    expect(brokersSeen([])).toEqual([])
  })
})
