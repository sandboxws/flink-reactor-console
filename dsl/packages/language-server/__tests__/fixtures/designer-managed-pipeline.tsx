// @flink-reactor designer
import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

// Designer-managed fixture (visual-designer §4): carries the pragma and
// satisfies the static-subset contract — literal props, identifier schema
// references, statically nested JSX, no loops/conditionals/spreads.

const OrdersSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
    region: Field.STRING(),
  },
})

const PaymentsSchema = Schema({
  fields: {
    payment_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

export default (
  <Pipeline name="designer-managed-pipeline">
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrdersSchema}
    />
    <KafkaSource
      topic="payments"
      bootstrapServers="kafka:9092"
      schema={PaymentsSchema}
    />
    <Filter condition="amount > 0" />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
