import { JdbcSink, KafkaSource, Pipeline, Schema } from "@flink-reactor/dsl"

export default (
  <Pipeline name="orders">
    <KafkaSource
      topic="orders"
      format="json"
      schema={Schema({ fields: { id: "BIGINT" } })}
    />
    <JdbcSink url="jdbc:postgresql://db/app" table="orders" />
  </Pipeline>
)
