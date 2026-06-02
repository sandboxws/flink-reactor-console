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

// The Filter references a back-tick-quoted column `amont` that does not exist
// on the upstream schema (typo of `amount`) → a schema-category finding with a
// did-you-mean suggestion.
export default (
  <Pipeline name="schema-typo">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="`amont` > 100" />
    <GenericSink connector="print" />
  </Pipeline>
)
