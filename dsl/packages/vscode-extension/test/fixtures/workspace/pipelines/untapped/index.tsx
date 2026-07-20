import { Filter, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// No `tap` props and no sink (dev-mode auto-taps apply to sinks only) →
// synthesis yields `tapManifest === null`: the tap panel's graceful,
// non-error empty state.
export default (
  <Pipeline name="untapped">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="`amount` > 0" />
  </Pipeline>
)
