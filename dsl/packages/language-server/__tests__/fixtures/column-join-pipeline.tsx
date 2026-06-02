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
    user_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

const UserSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    name: Field.STRING(),
  },
})

const orders = (
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
)

const users = (
  <KafkaSource
    topic="users"
    bootstrapServers="kafka:9092"
    schema={UserSchema}
  />
)

// A join exposes columns from both inputs inside its `on` condition.
export default (
  <Pipeline name="column-join-pipeline">
    <Join left={orders} right={users} on="user_id = id" type="inner" />
    <GenericSink connector="print" name="out" />
  </Pipeline>
)
