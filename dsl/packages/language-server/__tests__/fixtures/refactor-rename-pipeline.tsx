import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Map,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

// Column-rename fixture: `user_id` is declared with a primaryKey + watermark
// stake, referenced back-quoted by a Filter, and projected by a Map whose
// VALUE references the column while its KEY names the Map's own output — a
// rename must rewrite the declaration, PK entry, Filter ref, and Map value,
// and leave the Map key (the projection's output name) alone.
const EventSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
    event_time: Field.TIMESTAMP(3),
  },
  primaryKey: { columns: ["user_id"] },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '5' SECOND",
  },
})

export default (
  <Pipeline name="refactor-rename">
    <KafkaSource
      topic="events"
      bootstrapServers="kafka:9092"
      schema={EventSchema}
    />
    <Filter condition="`user_id` IS NOT NULL" />
    <Map select={{ user_id: "`user_id`", amount: "amount" }} />
    <GenericSink connector="print" />
  </Pipeline>
)
