import {
  Field,
  Filter,
  KafkaSink,
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

// Tap-visualization fixture: an explicitly tapped source (`tap={true}`), a
// named Filter tap, and an *untapped* Kafka sink that the dev-mode synthesis
// pass auto-taps (kafka → consumer-group-clone, a supported strategy) — three
// manifest entries, two explicit and one `autoTap: true`. The source nests
// inside the Filter because tap codegen resolves a transform's observation
// connector by walking its *children* (`resolveConnectorContext`); a
// sibling-chain transform tap would resolve `unknown` and be dropped.
export default (
  <Pipeline name="tap-pipeline">
    <Filter condition="`amount` > 100" tap={{ name: "filtered-orders" }}>
      <KafkaSource
        topic="orders"
        bootstrapServers="kafka:9092"
        schema={OrderSchema}
        tap={true}
      />
    </Filter>
    <KafkaSink topic="orders-out" bootstrapServers="kafka:9092" />
  </Pipeline>
)
