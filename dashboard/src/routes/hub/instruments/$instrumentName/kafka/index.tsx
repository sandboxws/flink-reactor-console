/**
 * Hub Kafka instrument index — /hub/instruments/$instrumentName/kafka.
 *
 * Topic browser: KPI strip + client-side tabs (Topics / Consumer groups).
 * Topic and consumer-group detail are reached by clicking a row.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { KafkaTopicBrowser } from "@/components/hub/instruments/kafka-topic-browser"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubKafkaIndex() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/kafka/",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Kafka" },
        ]}
        LinkComponent={HubLink}
      />
      <div className="mt-5">
        <KafkaTopicBrowser instrument={instrumentName} />
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/instruments/$instrumentName/kafka/")(
  {
    component: HubKafkaIndex,
  },
)
