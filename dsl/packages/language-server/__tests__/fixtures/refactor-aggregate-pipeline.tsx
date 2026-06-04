import {
  Aggregate,
  Field,
  FileSystemSink,
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
  watermark: {
    column: "order_time",
    expression: "order_time - INTERVAL '5' SECOND",
  },
})

// An unbounded (window-less) Aggregate emits a retract stream into an
// append-only FileSystemSink → the FR-CDC- changelog diagnostic both the
// wrap-in-window and swap-sink quick-fixes anchor to.
export default (
  <Pipeline name="refactor-aggregate">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Aggregate
      groupBy={["order_id"]}
      select={{ order_id: "order_id", total: "SUM(amount)" }}
    />
    <FileSystemSink path="/tmp/orders-agg" format="json" />
  </Pipeline>
)
