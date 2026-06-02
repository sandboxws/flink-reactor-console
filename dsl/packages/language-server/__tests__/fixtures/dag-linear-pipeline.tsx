import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

// The canonical linear shape for the graph model: Source → Filter → Sink.
// Excluding the <Pipeline> container, the graph is exactly 3 nodes / 2 edges.
export default (
  <Pipeline name="dag-linear">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > 100" />
    <GenericSink connector="print" name="sink_out" />
  </Pipeline>
)
