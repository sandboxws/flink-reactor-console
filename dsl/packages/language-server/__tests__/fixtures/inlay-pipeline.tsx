import {
  Aggregate,
  Field,
  Filter,
  IcebergCatalog,
  IcebergSink,
  Join,
  KafkaSource,
  Map,
  Pipeline,
  Schema,
  TumbleWindow,
} from "@flink-reactor/dsl"

const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    user_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
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

// Direct named factory call — located by the position predictor, so the
// catalog and every downstream node stay mapped (unlike an aliased call).
const iceberg = IcebergCatalog({
  name: "lakehouse",
  catalogType: "rest",
  uri: "http://iceberg-rest:8181",
  warehouse: "warehouse",
})

// One pipeline exercising every inlay-hint kind: two sources (schema/changelog/
// parallelism facts), a join (merged column count), a filter, a tumble window
// (injected window_start/window_end), a map (the projection the refresh test
// edits), and a catalog sink.
export default (
  <Pipeline name="inlay-pipeline" parallelism={4}>
    {iceberg.node}
    <Join left={orders} right={users} on="user_id = id" type="inner" />
    <Filter condition="amount > 0" />
    <TumbleWindow size="1 minute" on="order_time">
      <Aggregate
        groupBy={["user_id"]}
        select={{ user_id: "user_id", total: "SUM(amount)" }}
      />
    </TumbleWindow>
    <Map select={{ user_id: "user_id", total: "total" }} />
    <IcebergSink
      catalog={iceberg.handle}
      database="analytics"
      table="orders_agg"
    />
  </Pipeline>
)
