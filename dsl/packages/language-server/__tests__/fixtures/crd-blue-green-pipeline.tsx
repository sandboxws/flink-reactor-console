import {
  Field,
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

// A blue-green upgrade strategy makes synthesis emit a FlinkBlueGreenDeployment
// CRD instead of a plain FlinkDeployment — the crd-preview artifact's `kind`
// must reflect that. Checkpointing is enabled so the strategy is well-formed.
export default (
  <Pipeline
    name="blue-green-orders"
    checkpoint={{ interval: "30s" }}
    upgradeStrategy={{ mode: "blue-green" }}
  >
    <KafkaSource
      topic="orders"
      bootstrapServers="kafka:9092"
      schema={OrderSchema}
    />
    <GenericSink connector="print" />
  </Pipeline>
)
