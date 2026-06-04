import { Filter, KafkaSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// Tap-visualization fixture: an explicitly tapped source, a named Filter tap
// (the source nests inside it — tap codegen resolves a transform's
// observation connector through its children), and an untapped Kafka sink the
// dev-mode pass auto-taps.
export default (
  <Pipeline name="tapped">
    <Filter condition="`amount` > 100" tap={{ name: "filtered-orders" }}>
      <KafkaSource
        topic="orders"
        bootstrapServers="kafka:9092"
        schema={OrderSchema}
        tap={true}
      />
    </Filter>
    <KafkaSink topic="orders-out" bootstrapServers="kafka:9092" />
  </Pipeline>
)
