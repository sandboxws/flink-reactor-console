import {
  Field,
  Filter,
  JdbcSink,
  KafkaSource,
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

// All-literal-JSX so every node maps back to its source range (the
// source-position predictor needs literal elements). A `JdbcSink` with
// `upsertMode` is changelog-capable — it accepts retract/upsert input — without
// the programmatic catalog handle that Iceberg/Paimon sinks require (which would
// defeat id prediction).
export default (
  <Pipeline name="hover-pipeline">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > 0" />
    <JdbcSink
      url="jdbc:postgresql://db:5432/app"
      table="orders_filtered"
      upsertMode
      keyFields={["order_id"]}
    />
  </Pipeline>
)
