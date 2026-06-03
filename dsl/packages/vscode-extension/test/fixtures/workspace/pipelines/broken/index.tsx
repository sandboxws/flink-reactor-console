import { GenericSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// A deliberately broken pipeline: it throws while the module is evaluated, so
// synthesis fails. Opening the CRD preview here (with no prior good set) must
// show the synthesis error, not a blank or placeholder panel.
throw new Error("boom: this pipeline is intentionally broken")

export default (
  <Pipeline name="broken">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <GenericSink connector="print" />
  </Pipeline>
)
