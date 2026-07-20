import { Filter, GenericSink, KafkaSource, Pipeline } from "@flink-reactor/dsl"
import { OrderSchema } from "@/schemas/order"

// Designer e2e fixture: an ARBITRARY pipeline (no designer pragma) mixing
// editable literal props with computed/identifier props — read-only view +
// scalar literal edits work; computed props and structural edits refuse.

const FORMATS = { wire: "debezium-json" } as const
const wireKey = "wire" as const

export default (
  <Pipeline name="designer-arbitrary" stateTtl="1h">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      format={FORMATS[wireKey]}
      schema={OrderSchema}
    />
    <Filter condition="amount > 100" />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
