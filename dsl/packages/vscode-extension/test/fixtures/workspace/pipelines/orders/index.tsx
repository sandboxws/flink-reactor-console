import { Filter, GenericSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// The Filter references `amont`, a typo of `amount` not present on the schema,
// so the FlinkReactor language server publishes a schema-category FR diagnostic.
export default (
  <Pipeline name="orders">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="`amont` > 100" />
    <GenericSink connector="print" />
  </Pipeline>
)
