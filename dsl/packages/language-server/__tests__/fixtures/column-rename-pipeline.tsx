import {
  Field,
  Filter,
  JdbcSink,
  KafkaSource,
  Map,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const EventSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
    event_time: Field.TIMESTAMP(3),
  },
})

// A renaming Map (user_id → customer_id) so a downstream Filter sees the
// renamed columns, not the source's originals. All-literal JSX so every node
// maps back to its source range.
export default (
  <Pipeline name="column-rename-pipeline">
    <KafkaSource
      topic="events"
      bootstrapServers="kafka:9092"
      schema={EventSchema}
    />
    <Map select={{ customer_id: "user_id", amount: "amount" }} />
    <Filter condition="amount > 0" />
    <JdbcSink
      url="jdbc:postgresql://db:5432/app"
      table="out"
      upsertMode
      keyFields={["customer_id"]}
    />
  </Pipeline>
)
