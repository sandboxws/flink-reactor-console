/**
 * SchemaSubjectConsumers — best-effort "who consumes this subject" card.
 *
 * Schema Registry has no consumers endpoint, so this correlates across
 * instruments: map the subject to its Kafka topic via the default
 * TopicNameStrategy (`<topic>-value`/`-key`), then list Kafka consumer
 * groups that hold committed offsets on that topic. Degrades to an
 * "unavailable" state when no Kafka instrument is configured or the subject
 * doesn't follow the naming convention.
 *
 * The group→topic mapping requires per-group detail, so the fan-out is
 * bounded to the first N groups (documented below) to protect the backend.
 */

import { LiveDot } from "@flink-reactor/ui"
import { useEffect, useState } from "react"
import {
  fetchInstruments,
  fetchKafkaConsumerGroup,
  fetchKafkaConsumerGroups,
} from "@/lib/instruments-data"
import { subjectTopic } from "./schema-registry-derive"

/** Cap on per-group offset lookups, to bound the cross-instrument fan-out. */
const MAX_GROUPS_CHECKED = 30

type ConsumersState =
  | { kind: "loading" }
  | { kind: "no-topic" }
  | { kind: "no-kafka" }
  | { kind: "ready"; topic: string; groups: string[]; truncated: boolean }
  | { kind: "error"; message: string }

interface SchemaSubjectConsumersProps {
  subject: string
}

export function SchemaSubjectConsumers({
  subject,
}: SchemaSubjectConsumersProps) {
  const [state, setState] = useState<ConsumersState>({ kind: "loading" })

  useEffect(() => {
    const topic = subjectTopic(subject)
    if (!topic) {
      setState({ kind: "no-topic" })
      return
    }

    let cancelled = false
    setState({ kind: "loading" })
    ;(async () => {
      try {
        const instruments = await fetchInstruments()
        const kafka = instruments.find((i) => i.type === "kafka")
        if (!kafka) {
          if (!cancelled) setState({ kind: "no-kafka" })
          return
        }
        const groups = await fetchKafkaConsumerGroups(kafka.name)
        const checked = groups.slice(0, MAX_GROUPS_CHECKED)
        const details = await Promise.all(
          checked.map((g) => fetchKafkaConsumerGroup(kafka.name, g.groupId)),
        )
        const consuming = details
          .filter((d) => d.offsets.some((o) => o.topic === topic))
          .map((d) => d.groupId)
        if (!cancelled) {
          setState({
            kind: "ready",
            topic,
            groups: consuming,
            truncated: groups.length > MAX_GROUPS_CHECKED,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message:
              e instanceof Error ? e.message : "Failed to derive consumers",
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subject])

  return (
    <div className="glass-card-static p-4">
      <h3 className="section-heading mb-3">Consumers</h3>
      <ConsumersBody state={state} />
      {state.kind === "ready" ? (
        <p className="mt-2 text-[10px] text-fg-faint">
          Derived from Kafka consumer offsets via TopicNameStrategy
          {state.truncated
            ? ` · first ${MAX_GROUPS_CHECKED} groups checked`
            : ""}
          .
        </p>
      ) : null}
    </div>
  )
}

function ConsumersBody({ state }: { state: ConsumersState }) {
  switch (state.kind) {
    case "loading":
      return (
        <p className="text-[11.5px] font-mono text-fg-faint">
          Deriving consumers…
        </p>
      )
    case "no-topic":
      return (
        <p className="text-[11.5px] text-fg-muted">
          Subject does not follow the <span className="font-mono">-value</span>/
          <span className="font-mono">-key</span> naming convention — consumers
          unavailable.
        </p>
      )
    case "no-kafka":
      return (
        <p className="text-[11.5px] text-fg-muted">
          Unavailable — no Kafka instrument is configured to correlate
          consumers.
        </p>
      )
    case "error":
      return (
        <p className="text-[11.5px] text-fr-rose font-mono">{state.message}</p>
      )
    case "ready":
      if (state.groups.length === 0) {
        return (
          <p className="text-[11.5px] text-fg-muted">
            No consumer groups currently hold offsets on{" "}
            <span className="font-mono">{state.topic}</span>.
          </p>
        )
      }
      return (
        <ul className="space-y-1.5">
          {state.groups.map((g) => (
            <li key={g} className="flex items-center gap-2">
              <LiveDot tone="sage" />
              <span className="font-mono text-[12px] text-fg">{g}</span>
            </li>
          ))}
        </ul>
      )
  }
}
