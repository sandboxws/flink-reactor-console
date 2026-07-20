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

// The source declares `format: "debezium-avro"` but omits the conditionally
// required `schemaRegistryUrl` → a connector-category finding naming the
// missing prop, placed on the component.
export default (
  <Pipeline name="connector-missing-prop">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
      format="debezium-avro"
    />
    <GenericSink connector="print" />
  </Pipeline>
)
