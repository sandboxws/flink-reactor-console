import {
  Field,
  Filter,
  GenericSink,
  Join,
  KafkaSource,
  Map,
  Pipeline,
  Query,
  RawSQL,
  Schema,
  Validate,
} from "@flink-reactor/dsl"

// Exercises every embedded-SQL context kind for the embedded-sql-highlighting
// tests: a Schema watermark expression, Filter/Query.Where conditions, a Map
// projection record, a Join `on` condition, a Validate rule expression, and a
// RawSQL body. `name` props are deliberately present (and must NOT be colored).

const OrdersSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    user_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
    name: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '5' SECOND",
  },
})

const UsersSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    name: Field.STRING(),
  },
})

const orders = (
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrdersSchema}
  />
)
const users = (
  <KafkaSource
    topic="users"
    bootstrapServers="kafka:9092"
    schema={UsersSchema}
  />
)

export default (
  <Pipeline name="sql-highlight">
    <Join left={orders} right={users} on="user_id = id" type="inner" />
    <Filter condition="amount > 100 AND name = 'vip'" />
    <Map
      select={{
        total: "CAST(amount AS DECIMAL(12, 2))",
        upper_name: "UPPER(name)",
      }}
    />
    <Query.Where condition="event_time > CURRENT_WATERMARK(event_time)" />
    <Validate rules={{ expression: { positive: "amount > 0" } }} />
    <RawSQL sql="SELECT COUNT(*) FROM orders" outputSchema={UsersSchema} />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
