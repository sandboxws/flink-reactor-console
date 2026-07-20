import {
  Field,
  GenericSink,
  KafkaSource,
  Pipeline,
  Route,
  Schema,
} from "@flink-reactor/dsl"

const EventSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    kind: Field.STRING(),
    amount: Field.DECIMAL(10, 2),
  },
})

// Exercises dot-notation components (`Route.Branch` / `Route.Default`) for the
// source-position mapper.
export default (
  <Pipeline name="branching-pipeline">
    <KafkaSource
      topic="events"
      bootstrapServers="kafka:9092"
      schema={EventSchema}
    />
    <Route>
      <Route.Branch condition="amount > 1000">
        <GenericSink connector="print" name="big" />
      </Route.Branch>
      <Route.Default>
        <GenericSink connector="blackhole" name="rest" />
      </Route.Default>
    </Route>
  </Pipeline>
)
