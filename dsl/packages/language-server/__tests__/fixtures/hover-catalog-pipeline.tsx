import {
  Field,
  Filter,
  IcebergCatalog,
  IcebergSink,
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

// The catalog is created programmatically and rendered via an expression child,
// so it consumes a node-id counter slot the source-position predictor never
// sees — shifting every counter-based id and leaving the downstream nodes
// unmapped. That is the graceful-degradation path: hovering an unmapped (but
// recognizable) tag must return a minimal static card, never error.
const iceberg = IcebergCatalog({
  name: "lakehouse",
  catalogType: "rest",
  uri: "http://iceberg-rest:8181",
  warehouse: "warehouse",
})

export default (
  <Pipeline name="hover-catalog-pipeline">
    {iceberg.node}
    <KafkaSource topic="events" schema={OrderSchema} />
    <Filter condition="amount > 0" />
    <IcebergSink
      catalog={iceberg.handle}
      database="analytics"
      table="events_out"
    />
  </Pipeline>
)
