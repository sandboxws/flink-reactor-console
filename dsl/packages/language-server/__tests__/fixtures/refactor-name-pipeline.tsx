import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const CustomerSchema = Schema({
  fields: {
    customer_id: Field.BIGINT(),
    region: Field.STRING(),
  },
})

// Node-name rename fixture: the source is *named* `customers` and a
// downstream sink references it through the documented `from` table-reference
// pattern. The source's `topic` is the same string — an unrelated literal the
// rename must NOT touch.
export default (
  <Pipeline name="refactor-name">
    <KafkaSource
      name="customers"
      topic="customers"
      bootstrapServers="kafka:9092"
      schema={CustomerSchema}
    />
    <Filter condition="`customer_id` > 0" />
    <GenericSink
      connector="print"
      // @ts-expect-error — `from` is the documented name-reference pattern
      // (View: "used as table reference in downstream `from` props") not yet
      // typed on sink props; the LSP rename resolves it via the graph.
      from="customers"
    />
  </Pipeline>
)
