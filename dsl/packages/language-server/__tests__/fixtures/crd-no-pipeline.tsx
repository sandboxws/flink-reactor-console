import { Field, KafkaSource, Schema } from "@flink-reactor/dsl"

const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

// The default export is a bare <KafkaSource> (kind "Source"), not a <Pipeline>,
// so synthesis short-circuits with a `no-pipeline` load error — the crd-preview
// request must resolve with `status: "no-pipeline"`, not reject.
export default (
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
)
