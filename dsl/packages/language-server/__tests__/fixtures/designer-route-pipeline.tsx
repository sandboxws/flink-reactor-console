// @flink-reactor designer
import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Route,
  Schema,
} from "@flink-reactor/dsl"

// Designer-managed fixture with a hierarchy-restricted parent (`Route` allows
// only `Route.Branch`/`Route.Default`) for re-parent rule tests (task 4.6).

const EventsSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

export default (
  <Pipeline name="designer-route-pipeline">
    <KafkaSource
      topic="events"
      bootstrapServers="kafka:9092"
      schema={EventsSchema}
    />
    <Filter condition="amount > 0" />
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
