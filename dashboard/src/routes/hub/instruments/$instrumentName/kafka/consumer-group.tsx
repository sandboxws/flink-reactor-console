/**
 * Hub Kafka consumer-group detail —
 * /hub/instruments/$instrumentName/kafka/consumer-group.
 *
 * Reads `?groupId=...` and renders the group's members and per-partition
 * offsets/lag. Falls back to a "pick a group" message when the param is absent.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { KafkaConsumerGroupDetail } from "@/components/hub/instruments/kafka-consumer-group-detail"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

interface KafkaGroupSearch {
  groupId?: string
}

function HubKafkaConsumerGroup() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/kafka/consumer-group",
  })
  const { groupId } = useSearch({
    from: "/hub/instruments/$instrumentName/kafka/consumer-group",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Kafka", to: `/hub/instruments/${instrumentName}/kafka` },
          { label: groupId ?? "(pick a group)", mono: true },
        ]}
        LinkComponent={HubLink}
      />
      <div className="mt-5">
        {groupId ? (
          <KafkaConsumerGroupDetail
            instrument={instrumentName}
            groupId={groupId}
          />
        ) : (
          <p className="text-[12px] font-mono text-fg-faint">
            Pick a consumer group from the Kafka overview.
          </p>
        )}
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/kafka/consumer-group",
)({
  validateSearch: (search: Record<string, unknown>): KafkaGroupSearch => ({
    groupId: typeof search.groupId === "string" ? search.groupId : undefined,
  }),
  component: HubKafkaConsumerGroup,
})
