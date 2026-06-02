import {
  Field,
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

// `lonely` is declared after the source→sink chain and is never consumed by a
// downstream sink → a structural (orphan-source) finding on that node.
export default (
  <Pipeline name="orphan-source">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <GenericSink connector="print" />
    <KafkaSource
      topic="lonely"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
  </Pipeline>
)
