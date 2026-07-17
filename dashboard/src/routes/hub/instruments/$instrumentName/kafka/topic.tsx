/**
 * Hub Kafka topic detail — /hub/instruments/$instrumentName/kafka/topic.
 *
 * Reads `?name=...` and renders the topic's partitions, config, and broker
 * topology. Falls back to a "pick a topic" message when the param is absent.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { KafkaTopicDetail } from "@/components/hub/instruments/kafka-topic-detail"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

interface KafkaTopicSearch {
  name?: string
}

function HubKafkaTopic() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/kafka/topic",
  })
  const { name } = useSearch({
    from: "/hub/instruments/$instrumentName/kafka/topic",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Kafka", to: `/hub/instruments/${instrumentName}/kafka` },
          { label: name ?? "(pick a topic)", mono: true },
        ]}
        LinkComponent={HubLink}
      />
      <div className="mt-5">
        {name ? (
          <KafkaTopicDetail instrument={instrumentName} topicName={name} />
        ) : (
          <p className="text-[12px] font-mono text-fg-faint">
            Pick a topic from the Kafka overview.
          </p>
        )}
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/kafka/topic",
)({
  validateSearch: (search: Record<string, unknown>): KafkaTopicSearch => ({
    name: typeof search.name === "string" ? search.name : undefined,
  }),
  component: HubKafkaTopic,
})
