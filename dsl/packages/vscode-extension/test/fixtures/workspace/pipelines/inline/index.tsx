import {
  Field,
  Filter,
  GenericSink,
  KafkaSource,
  Pipeline,
  Schema,
} from "@flink-reactor/dsl"

// An inline-schema pipeline: editing the `Schema({ fields })` here changes the
// Schema Explorer directly (the live-refresh e2e case).
const InlineSchema = Schema({
  fields: {
    id: Field.BIGINT(),
    name: Field.STRING(),
  },
})

export default (
  <Pipeline name="inline">
    <KafkaSource
      topic="inline"
      bootstrapServers="kafka:9092"
      schema={InlineSchema}
    />
    <Filter condition="id > 0" />
    <GenericSink connector="print" name="inline_out" />
  </Pipeline>
)
