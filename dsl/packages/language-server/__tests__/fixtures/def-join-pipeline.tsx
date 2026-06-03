import {
  Field,
  GenericSink,
  Join,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    total: Field.DECIMAL(10, 2),
  },
})

const PaymentSchema = Schema({
  fields: {
    payment_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

const orders = (
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
)

const payments = (
  <KafkaSource
    topic="payments"
    bootstrapServers="kafka:9092"
    schema={PaymentSchema}
  />
)

// A join wires two upstream sources by variable and qualifies columns by the
// input's alias — the component-input and qualified-column cases.
export default (
  <Pipeline name="def-join-pipeline">
    <Join
      left={orders}
      right={payments}
      on="orders.total = payments.amount"
      type="inner"
    />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
