import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const EventSchema = Schema({
  fields: {
    event_id: Field.BIGINT(),
    user_id: Field.BIGINT(),
    event_time: Field.TIMESTAMP(3),
  },
  primaryKey: { columns: ["event_id"] },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '5' SECOND",
  },
})

// A source declaring a primary key and a watermark, feeding a sink — the
// schema-tree projection cases (fields, PK marking, watermark, sink input).
export default (
  <Pipeline name="def-schema-tree-pipeline">
    <KafkaSource
      topic="events"
      bootstrapServers="kafka:9092"
      schema={EventSchema}
    />
    <Filter condition="user_id > 0" />
    <GenericSink connector="print" name="events_out" />
  </Pipeline>
)
