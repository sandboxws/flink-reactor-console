import {
  Aggregate,
  Field,
  GenericSink,
  KafkaSource,
  Pipeline,
  Query,
  Schema,
  TumbleWindow,
} from "@flink-reactor/dsl"

const ClickSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    page_url: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
})

const OutputSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    views: Field.BIGINT(),
    window_start: Field.TIMESTAMP(3),
    window_end: Field.TIMESTAMP(3),
  },
})

// A windowed aggregation injects window_start/window_end, visible to a
// downstream Query.Select.
export default (
  <Pipeline name="column-window-pipeline">
    <KafkaSource
      topic="clicks"
      bootstrapServers="kafka:9092"
      schema={ClickSchema}
    />
    <TumbleWindow size="1 minute" on="event_time">
      <Aggregate
        groupBy={["user_id"]}
        select={{ user_id: "user_id", views: "COUNT(*)" }}
      />
    </TumbleWindow>
    <Query outputSchema={OutputSchema}>
      <Query.Select
        columns={{
          user_id: "user_id",
          views: "views",
          window_start: "window_start",
          window_end: "window_end",
        }}
      />
      <Query.Where condition="views > 0" />
    </Query>
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
