import {
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
  },
  primaryKey: { columns: ["order_id"] },
})

// A retract (CDC) source — a `debezium-avro` Kafka source emits a changelog
// stream — feeding an append-only `FileSystemSink`. That is a changelog
// incompatibility: the diagnostic is placed on the sink with a cross-node
// related-information link back to the source. `schemaRegistryUrl` is supplied
// so the only finding is the changelog one (no connector finding).
export default (
  <Pipeline name="changelog-cross-node">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
      format="debezium-avro"
      schemaRegistryUrl="http://registry:8081"
    />
    <FileSystemSink path="/tmp/orders-out" format="json" />
  </Pipeline>
)
