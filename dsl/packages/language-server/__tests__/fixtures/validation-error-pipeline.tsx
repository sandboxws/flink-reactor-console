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

// The Filter has a syntactically invalid SQL condition → an expression-category
// validation error attributed to the Filter node.
export default (
  <Pipeline name="validation-error">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > > 100 AND" />
    <GenericSink connector="print" />
  </Pipeline>
)
