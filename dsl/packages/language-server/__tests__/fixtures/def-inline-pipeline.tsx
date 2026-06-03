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

// A linear pipeline whose Filter references columns by bare and back-quoted
// name — the inline-schema go-to-definition cases.
export default (
  <Pipeline name="def-inline-pipeline">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > 0 AND `order_id` > 1000" />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
