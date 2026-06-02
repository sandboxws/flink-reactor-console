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

// Default export is a zero-argument function returning the pipeline — the
// loader's resolution tier 2 must invoke it.
export default () => (
  <Pipeline name="fn-default-pipeline">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <GenericSink connector="print" />
  </Pipeline>
)
