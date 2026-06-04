import {
  Field,
  Filter,
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

// No `tap` props and no sink to auto-tap (dev-mode auto-taps apply to sinks
// only) → synthesis yields `tapManifest === null`, the valid "no operators
// tapped" state the manifest request maps to `ok: true` + empty `taps`.
export default (
  <Pipeline name="tap-none">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="`amount` > 0" />
  </Pipeline>
)
