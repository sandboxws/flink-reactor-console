import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

// Classifier parity fixture (visual-designer task 2.7): one prop per source
// form — literal, identifier, member access, computed/element access, call,
// arrow, interpolated template, literal array, and a spread.

const OrdersSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

const cfg = { servers: "kafka:9092" }
const WIRE_FORMAT = { debezium: "debezium-json" } as const
const fmtKey = "debezium" as const
const host = "registry"
const getGroup = (): string => "orders-group"
const sinkExtras = {}

export default (
  <Pipeline name="designer-classifier-pipeline" stateTtl="1h">
    <KafkaSource
      topic="orders"
      schema={OrdersSchema}
      bootstrapServers={cfg.servers}
      format={WIRE_FORMAT[fmtKey]}
      consumerGroup={getGroup()}
      schemaRegistryUrl={`http://${host}:8081`}
      primaryKey={["id"]}
      tap={false}
    />
    <Filter
      condition="amount > 0"
      parallelism={2}
      // @ts-expect-error — deliberate unknown prop: an arrow initializer the
      // classifier must mark readOnly (synthesis ignores unknown props).
      debug={() => true}
    />
    <GenericSink connector="print" name="out" {...sinkExtras} />
  </Pipeline>
)
