import { Filter, GenericSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// A pristine cross-file-schema pipeline owned solely by the Schema Explorer
// e2e suite (no other suite edits it), so its source stays position-mapped and
// the field locationRefs resolve into `schemas/order.ts` deterministically.
export default (
  <Pipeline name="schematree">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <Filter condition="amount > 0" />
    <GenericSink connector="print" name="schematree_out" />
  </Pipeline>
)
