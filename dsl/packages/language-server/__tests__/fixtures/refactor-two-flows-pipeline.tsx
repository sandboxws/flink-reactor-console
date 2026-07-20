import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

// Two unrelated schemas each declare `user_id` and feed separate, unjoined
// branches — renaming the first schema's `user_id` must leave the second
// schema's declaration and its references untouched (resolved identity, never
// the raw string).
const FirstSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

const SecondSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    score: Field.INT(),
  },
})

export default (
  <Pipeline name="refactor-two-flows">
    <KafkaSource
      topic="first-events"
      bootstrapServers="kafka:9092"
      schema={FirstSchema}
    />
    <Filter condition="`user_id` > 0" />
    <GenericSink connector="print" name="first_out" />
    <KafkaSource
      topic="second-events"
      bootstrapServers="kafka:9092"
      schema={SecondSchema}
    />
    <Filter condition="`user_id` < 100" />
    <GenericSink connector="print" name="second_out" />
  </Pipeline>
)
