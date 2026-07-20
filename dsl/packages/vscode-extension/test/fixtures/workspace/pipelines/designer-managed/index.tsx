// @flink-reactor designer
import { Filter, GenericSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// Designer e2e fixture: a designer-managed pipeline — the pragma + a fully
// static body (literal props, identifier schema reference) make structural
// edits (add/delete/re-parent/add-join) safe by construction.

export default (
  <Pipeline name="designer-managed">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > 100" />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
