import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Map,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
  },
})

export default (
  <Pipeline name="valid-pipeline" parallelism={4}>
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > 100" />
    <Map select={{ order_id: "order_id", amount: "amount" }} />
    <GenericSink connector="print" />
  </Pipeline>
)
