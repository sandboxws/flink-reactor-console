import {
  Field,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

// An inline `Schema({...})` passed directly to a source's `schema` prop — the
// extract-inline-schema refactor lifts it into `schemas/payments.ts` and
// rewires the prop to the imported identifier.
export default (
  <Pipeline name="refactor-inline-schema">
    <KafkaSource
      topic="payments"
      bootstrapServers="kafka:9092"
      schema={Schema({
        fields: {
          payment_id: Field.BIGINT(),
          amount: Field.DECIMAL(10, 2),
        },
      })}
    />
    <GenericSink connector="print" />
  </Pipeline>
)
