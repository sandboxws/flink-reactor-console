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

// The source misspells `bootstrapServers` as `bootstrapServer` → the
// connector validator reports the real prop missing, and the quick-fix offers
// renaming the near-miss key (preserving its value).
export default (
  <Pipeline name="refactor-prop-typo">
    <KafkaSource
      topic="orders"
      schema={OrderSchema}
      // @ts-expect-error — deliberate misspelling of `bootstrapServers` (the
      // fixture for the rename-prop did-you-mean quick-fix)
      bootstrapServer="kafka:9092"
    />
    <Filter condition="`amount` > 0" />
    <GenericSink connector="print" />
  </Pipeline>
)
