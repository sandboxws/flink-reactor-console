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
  },
})

// Throws during module evaluation — the loader must surface this as a single
// load-error diagnostic, not crash the server. Done via a helper call (rather
// than a bare `throw`) so the export below stays syntactically reachable.
function boom(): never {
  throw new Error("intentional boom during pipeline evaluation")
}
boom()

export default (
  <Pipeline name="never-reached">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <GenericSink connector="print" />
  </Pipeline>
)
