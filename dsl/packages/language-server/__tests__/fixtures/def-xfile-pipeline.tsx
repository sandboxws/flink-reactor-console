import { Filter, GenericSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrdersSchema } from "./schemas/orders"

// The source's schema is declared in a separate module, so a column reference
// resolves across files into `schemas/orders.ts`.
export default (
  <Pipeline name="def-xfile-pipeline">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrdersSchema}
    />
    <Filter condition="o_orderkey > 0" />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
