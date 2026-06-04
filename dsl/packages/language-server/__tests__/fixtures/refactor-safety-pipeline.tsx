import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

// Safety-gate fixture: the source receives part of its props via a spread
// (so no literal attribute can be inserted on it) and the Filter's condition
// is a computed expression (so no column token inside it is renamable).
const extra = { format: "json" } as const
const condition = "`order_id` > 0"

export default (
  <Pipeline name="refactor-safety">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
      {...extra}
    />
    <Filter condition={condition} />
    <GenericSink connector="print" />
  </Pipeline>
)
