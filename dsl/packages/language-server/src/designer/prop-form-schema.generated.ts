// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Build-time prop-FORM schema projected from the DSL's typed component prop
// interfaces by `scripts/generate-prop-form-schema.ts` (visual-designer,
// Tier-3 feature 15). The designer webview renders prop forms from this table
// — string-literal unions as dropdowns, required markers honoring interface
// optionality AND `requireProps(...)`, JSDoc as field help — so the form can
// never drift from the DSL types. Pure data, zero imports: safe to inline
// into any bundle.
//
// Regenerate: pnpm --filter @flink-reactor/language-server gen:prop-form-schema

/** The form input a prop's TypeScript type reduces to. */
export type PropInputKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "array"
  | "object"

/** One prop projected as a form field. */
export interface PropFormField {
  /** Prop (attribute) name. */
  readonly name: string
  /** True when non-optional in the interface OR listed in `requireProps(...)`. */
  readonly required: boolean
  /** Input kind derived from the (alias-resolved) type. */
  readonly inputKind: PropInputKind
  /** Human-readable type string (alias name or checker output). */
  readonly type: string
  /** Present iff `inputKind === "enum"` — the string-literal union members. */
  readonly options?: readonly string[]
  /** JSDoc summary, rendered as inline field help. */
  readonly help?: string
  /** True when the type has no literal form representation (object/generic/
   *  callback) — the form renders it read-only with "Edit in source". */
  readonly readOnlyInForm: boolean
}

/** One component's complete prop-form schema. */
export interface ComponentFormSchema {
  readonly component: string
  /** Props the component's `requireProps(...)` call enforces at synthesis. */
  readonly runtimeRequired: readonly string[]
  /** Form fields: required first, then alphabetical. */
  readonly fields: readonly PropFormField[]
}

/** component name → its prop-form schema. */
export const PROP_FORM_SCHEMA: Record<string, ComponentFormSchema> = {
  "AddField": {
    component: "AddField",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"object","type":"Record","help":"Record mapping new field names to SQL expressions: { newFieldName: 'sqlExpr' }","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"types","required":false,"inputKind":"object","type":"Record","help":"Optional type hints for the new fields: { newFieldName: 'BIGINT' }","readOnlyInForm":true},
    ],
  },
  "Aggregate": {
    component: "Aggregate",
    runtimeRequired: [],
    fields: [
      {"name":"groupBy","required":true,"inputKind":"array","type":"readonly string[]","help":"Fields to group by","readOnlyInForm":false},
      {"name":"select","required":true,"inputKind":"object","type":"Record","help":"Record mapping output fields to aggregate expressions (e.g. 'COUNT(*)', 'SUM(amount)')","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "Cast": {
    component: "Cast",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"object","type":"Record","help":"Record mapping field names to target Flink SQL types: { fieldName: 'BIGINT' }","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"safe","required":false,"inputKind":"boolean","type":"boolean","help":"Use TRY_CAST instead of CAST (default: false)","readOnlyInForm":false},
    ],
  },
  "CatalogSource": {
    component: "CatalogSource",
    runtimeRequired: [],
    fields: [
      {"name":"catalog","required":true,"inputKind":"object","type":"CatalogHandle","readOnlyInForm":true},
      {"name":"database","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"table","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Coalesce": {
    component: "Coalesce",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"object","type":"Record","help":"Record mapping field names to default SQL expressions: { fieldName: 'defaultExpr' }","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Deduplicate": {
    component: "Deduplicate",
    runtimeRequired: [],
    fields: [
      {"name":"keep","required":true,"inputKind":"enum","type":"\"first\" | \"last\"","options":["first","last"],"help":"Keep the first or last row per key","readOnlyInForm":false},
      {"name":"key","required":true,"inputKind":"array","type":"readonly string[]","help":"Fields forming the deduplication key","readOnlyInForm":false},
      {"name":"order","required":true,"inputKind":"string","type":"string","help":"Field to order by for selecting which row to keep","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "Drop": {
    component: "Drop",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"array","type":"readonly string[]","help":"Field names to exclude from the output","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "FileSystemSink": {
    component: "FileSystemSink",
    runtimeRequired: ["path"],
    fields: [
      {"name":"path","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"format","required":false,"inputKind":"enum","type":"FileFormat","options":["parquet","orc","csv","json"],"readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to the last path segment.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"partitionBy","required":false,"inputKind":"array","type":"readonly string[]","readOnlyInForm":false},
      {"name":"rollingPolicy","required":false,"inputKind":"object","type":"RollingPolicy","readOnlyInForm":true},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this sink","readOnlyInForm":true},
    ],
  },
  "Filter": {
    component: "Filter",
    runtimeRequired: [],
    fields: [
      {"name":"condition","required":true,"inputKind":"string","type":"string","help":"SQL WHERE expression (e.g. \"amount > 100 AND status = 'active'\")","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "FlatMap": {
    component: "FlatMap",
    runtimeRequired: [],
    fields: [
      {"name":"as","required":true,"inputKind":"object","type":"Record","help":"Output field schema for the unnested elements","readOnlyInForm":true},
      {"name":"unnest","required":true,"inputKind":"string","type":"string","help":"Field name to expand (array or map column)","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "GenericCatalog": {
    component: "GenericCatalog",
    runtimeRequired: [],
    fields: [
      {"name":"name","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"type","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"options","required":false,"inputKind":"object","type":"Record","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "GenericSink": {
    component: "GenericSink",
    runtimeRequired: ["connector"],
    fields: [
      {"name":"connector","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to the connector name.","readOnlyInForm":false},
      {"name":"options","required":false,"inputKind":"object","type":"Record","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this sink","readOnlyInForm":true},
    ],
  },
  "GenericSource": {
    component: "GenericSource",
    runtimeRequired: ["connector","schema"],
    fields: [
      {"name":"connector","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"schema","required":true,"inputKind":"object","type":"SchemaDefinition<T>","readOnlyInForm":true},
      {"name":"format","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to the connector name.","readOnlyInForm":false},
      {"name":"options","required":false,"inputKind":"object","type":"Record","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this source","readOnlyInForm":true},
    ],
  },
  "HiveCatalog": {
    component: "HiveCatalog",
    runtimeRequired: [],
    fields: [
      {"name":"hiveConfDir","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"name","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "IcebergCatalog": {
    component: "IcebergCatalog",
    runtimeRequired: [],
    fields: [
      {"name":"catalogType","required":true,"inputKind":"enum","type":"IcebergCatalogType","options":["hive","hadoop","rest"],"readOnlyInForm":false},
      {"name":"name","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"uri","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"warehouse","required":false,"inputKind":"string","type":"string","help":"Warehouse identifier passed to the catalog server. Required by REST\ncatalogs that host multiple warehouses (e.g. Lakekeeper) — the value is\nthe registered warehouse name there. Optional for single-warehouse\nservers (e.g. tabulario/iceberg-rest).","readOnlyInForm":false},
    ],
  },
  "IcebergSink": {
    component: "IcebergSink",
    runtimeRequired: [],
    fields: [
      {"name":"catalog","required":true,"inputKind":"object","type":"CatalogHandle","readOnlyInForm":true},
      {"name":"database","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"table","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"commitIntervalSeconds","required":false,"inputKind":"number","type":"number","help":"Iceberg writer flush cadence. Maps to `commit-interval-ms` (×1000).\n\nRecommended defaults for CDC workloads:\n  • 10s — throughput-oriented runs\n  • 2–5s — latency-oriented runs","readOnlyInForm":false},
      {"name":"equalityFieldColumns","required":false,"inputKind":"array","type":"readonly string[]","help":"Columns that drive Iceberg equality-delete writes for MoR.\nDeclared independently from `primaryKey`: in practice they are usually\nthe same set, but Iceberg treats them as two distinct concepts and\nwithout at least one of them set, `upsertEnabled: true` cannot produce\nreal row-level deletes (falls back to position-only deletes).\n\nWhen omitted but `primaryKey` is set, synthesis derives the Iceberg\n`equality-field-columns` entry from `primaryKey`.","readOnlyInForm":false},
      {"name":"formatVersion","required":false,"inputKind":"number","type":"1 | 2","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"primaryKey","required":false,"inputKind":"array","type":"readonly string[]","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this sink","readOnlyInForm":true},
      {"name":"targetFileSizeMB","required":false,"inputKind":"number","type":"number","help":"Target size per data file in MB. Maps to `write.target-file-size-bytes`\n(×1048576). Pair with `writeDistributionMode` to bound write-amplification.\n\nRecommended defaults: 256 for snapshot backfills, 64 for steady-state live.","readOnlyInForm":false},
      {"name":"upsertEnabled","required":false,"inputKind":"boolean","type":"boolean","readOnlyInForm":false},
      {"name":"writeDistributionMode","required":false,"inputKind":"enum","type":"IcebergWriteDistributionMode","options":["none","hash","range"],"help":"Partition-aware write routing. Maps to `write.distribution-mode`.\n\nUse `'hash'` under any non-trivial parallelism to avoid small-file\nexplosion; `'none'` + `parallelism > 1` emits a synthesis warning.","readOnlyInForm":false},
      {"name":"writeParquetCompression","required":false,"inputKind":"enum","type":"IcebergParquetCompression","options":["none","zstd","snappy","gzip"],"help":"Parquet codec. Maps to `write.parquet.compression-codec`.\n`'zstd'` is the defensible default for CDC workloads.","readOnlyInForm":false},
    ],
  },
  "IntervalJoin": {
    component: "IntervalJoin",
    runtimeRequired: [],
    fields: [
      {"name":"interval","required":true,"inputKind":"object","type":"IntervalBounds","help":"Time interval bounds for the join window","readOnlyInForm":true},
      {"name":"left","required":true,"inputKind":"object","type":"ConstructNode","help":"Left input stream","readOnlyInForm":true},
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"SQL join condition","readOnlyInForm":false},
      {"name":"right","required":true,"inputKind":"object","type":"ConstructNode","help":"Right input stream","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this join","readOnlyInForm":true},
      {"name":"type","required":false,"inputKind":"enum","type":"\"inner\" | \"left\" | \"right\" | \"full\"","options":["inner","left","right","full"],"help":"Join type (default: 'inner')","readOnlyInForm":false},
    ],
  },
  "JdbcCatalog": {
    component: "JdbcCatalog",
    runtimeRequired: [],
    fields: [
      {"name":"baseUrl","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"defaultDatabase","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"name","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "JdbcSink": {
    component: "JdbcSink",
    runtimeRequired: ["url","table"],
    fields: [
      {"name":"table","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"url","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"keyFields","required":false,"inputKind":"array","type":"readonly string[]","readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to the JDBC table name.","readOnlyInForm":false},
      {"name":"onConflict","required":false,"inputKind":"enum","type":"\"DO NOTHING\" | \"DO ERROR\" | \"DO DEDUPLICATE\"","options":["DO NOTHING","DO ERROR","DO DEDUPLICATE"],"help":"Upsert conflict strategy → trailing `ON CONFLICT DO …` clause on the\ngenerated INSERT (Flink 2.3+, FLIP-558). Only meaningful for upsert sinks.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this sink","readOnlyInForm":true},
      {"name":"upsertMode","required":false,"inputKind":"boolean","type":"boolean","readOnlyInForm":false},
    ],
  },
  "JdbcSource": {
    component: "JdbcSource",
    runtimeRequired: ["url","table","schema"],
    fields: [
      {"name":"schema","required":true,"inputKind":"object","type":"SchemaDefinition<T>","readOnlyInForm":true},
      {"name":"table","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"url","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"lookupCache","required":false,"inputKind":"object","type":"LookupCacheConfig","readOnlyInForm":true},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to the JDBC table name.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this source","readOnlyInForm":true},
    ],
  },
  "Join": {
    component: "Join",
    runtimeRequired: [],
    fields: [
      {"name":"left","required":true,"inputKind":"object","type":"ConstructNode","help":"Left input stream (construct node)","readOnlyInForm":true},
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"SQL join condition (e.g. \"a.user_id = b.user_id\")","readOnlyInForm":false},
      {"name":"right","required":true,"inputKind":"object","type":"ConstructNode","help":"Right input stream (construct node)","readOnlyInForm":true},
      {"name":"hints","required":false,"inputKind":"object","type":"JoinHints","help":"Query hints for join optimization","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"stateTtl","required":false,"inputKind":"string","type":"string","help":"State TTL for join state expiry (e.g. '1h', '30min')","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this join","readOnlyInForm":true},
      {"name":"type","required":false,"inputKind":"enum","type":"JoinType","options":["inner","left","right","full","anti","semi"],"help":"Join type (default: 'inner')","readOnlyInForm":false},
    ],
  },
  "KafkaSink": {
    component: "KafkaSink",
    runtimeRequired: ["topic"],
    fields: [
      {"name":"topic","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"bootstrapServers","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"format","required":false,"inputKind":"enum","type":"SinkFormat","options":["csv","json","avro","debezium-json","debezium-avro","debezium-protobuf","canal-json"],"readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to topic name normalized as a SQL identifier.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"schemaRegistryUrl","required":false,"inputKind":"string","type":"string","help":"Confluent Schema Registry URL. Required when `format` is `\"debezium-avro\"`\nor `\"debezium-protobuf\"`.","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this sink","readOnlyInForm":true},
    ],
  },
  "KafkaSource": {
    component: "KafkaSource",
    runtimeRequired: ["topic","schema"],
    fields: [
      {"name":"schema","required":true,"inputKind":"object","type":"SchemaDefinition<T>","readOnlyInForm":true},
      {"name":"topic","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"bootstrapServers","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"consumerGroup","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"format","required":false,"inputKind":"enum","type":"KafkaFormat","options":["csv","json","avro","debezium-json","debezium-avro","debezium-protobuf","canal-json","maxwell-json"],"readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to topic name normalized as a SQL identifier.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"primaryKey","required":false,"inputKind":"array","type":"readonly string[]","readOnlyInForm":false},
      {"name":"schemaRegistryUrl","required":false,"inputKind":"string","type":"string","help":"Confluent Schema Registry URL. Required when `format` is `\"debezium-avro\"`\nor `\"debezium-protobuf\"` — the Flink deserializer fetches the writer schema\nfrom this endpoint at runtime. The deployment template must expose a\nreachable Schema Registry (in-cluster sidecar or external endpoint); see\nthe Confluent `flink-sql-avro-confluent-registry` /\n`flink-sql-protobuf-confluent-registry` format docs for the request shape.","readOnlyInForm":false},
      {"name":"startupMode","required":false,"inputKind":"enum","type":"KafkaStartupMode","options":["latest-offset","earliest-offset","group-offsets","timestamp"],"readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this source","readOnlyInForm":true},
      {"name":"watermark","required":false,"inputKind":"object","type":"WatermarkDeclaration","readOnlyInForm":true},
    ],
  },
  "LateralJoin": {
    component: "LateralJoin",
    runtimeRequired: [],
    fields: [
      {"name":"args","required":true,"inputKind":"object","type":"readonly (string | number)[]","help":"Arguments passed to the TVF (column refs or literals)","readOnlyInForm":true},
      {"name":"as","required":true,"inputKind":"object","type":"Record","help":"Output column names and types from the TVF","readOnlyInForm":true},
      {"name":"function","required":true,"inputKind":"string","type":"string","help":"TVF name (registered via UDF or built-in like VECTOR_SEARCH)","readOnlyInForm":false},
      {"name":"input","required":true,"inputKind":"object","type":"ConstructNode","help":"Upstream stream to join against","readOnlyInForm":true},
      {"name":"outputSchema","required":false,"inputKind":"object","type":"SchemaDefinition<Record<string, FlinkType>>","help":"Schema of the combined output","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"type","required":false,"inputKind":"enum","type":"\"left\" | \"cross\"","options":["left","cross"],"help":"Join type: 'cross' (default) or 'left'","readOnlyInForm":false},
    ],
  },
  "LookupJoin": {
    component: "LookupJoin",
    runtimeRequired: [],
    fields: [
      {"name":"input","required":true,"inputKind":"object","type":"ConstructNode","help":"The driving input stream","readOnlyInForm":true},
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"Join key. A bare column name (`\"customer_id\"`) is treated as an\nequi-join on that column present on both sides; a full condition\n(`\"o.customer_id = c.customer_id\"`) is emitted verbatim.","readOnlyInForm":false},
      {"name":"async","required":false,"inputKind":"object","type":"LookupAsyncConfig","help":"Async lookup configuration","readOnlyInForm":true},
      {"name":"cache","required":false,"inputKind":"object","type":"LookupCacheConfig$1","help":"Lookup cache configuration (inline form)","readOnlyInForm":true},
      {"name":"dimension","required":false,"inputKind":"object","type":"ConstructNode","help":"Dimension table as a source node (e.g. a `JdbcSource`). Provide this\nOR the inline `table` + `url` + `schema` props — the inline form is\nsugar that builds an equivalent `JdbcSource` for you.","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"schema","required":false,"inputKind":"object","type":"SchemaDefinition<Record<string, FlinkType>>","help":"Dimension table schema — columns + primary key (inline form)","readOnlyInForm":true},
      {"name":"select","required":false,"inputKind":"object","type":"Record","help":"Output field mapping","readOnlyInForm":true},
      {"name":"table","required":false,"inputKind":"string","type":"string","help":"Dimension table name (inline form; ignored when `dimension` is set)","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this join","readOnlyInForm":true},
      {"name":"url","required":false,"inputKind":"string","type":"string","help":"JDBC connection URL for the dimension table (inline form)","readOnlyInForm":false},
    ],
  },
  "Map": {
    component: "Map",
    runtimeRequired: [],
    fields: [
      {"name":"select","required":true,"inputKind":"object","type":"Record","help":"Record mapping output field names to SQL expressions","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "MatchRecognize": {
    component: "MatchRecognize",
    runtimeRequired: [],
    fields: [
      {"name":"define","required":true,"inputKind":"object","type":"Record","help":"Map of pattern variable → boolean SQL condition","readOnlyInForm":true},
      {"name":"input","required":true,"inputKind":"object","type":"ConstructNode","help":"Input stream to match patterns against","readOnlyInForm":true},
      {"name":"measures","required":true,"inputKind":"object","type":"Record","help":"Map of output column name → SQL expression using pattern variables","readOnlyInForm":true},
      {"name":"pattern","required":true,"inputKind":"string","type":"string","help":"Row-pattern string using pattern variables (e.g. 'A B+ C')","readOnlyInForm":false},
      {"name":"after","required":false,"inputKind":"enum","type":"MatchAfterStrategy","options":["MATCH_RECOGNIZED","NEXT_ROW"],"help":"Match strategy after a match is found","readOnlyInForm":false},
      {"name":"orderBy","required":false,"inputKind":"string","type":"string","help":"Field to order the input by (required for event ordering)","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"partitionBy","required":false,"inputKind":"array","type":"readonly string[]","help":"Fields to partition the input by before matching","readOnlyInForm":false},
    ],
  },
  "MaterializedTable": {
    component: "MaterializedTable",
    runtimeRequired: [],
    fields: [
      {"name":"catalog","required":true,"inputKind":"object","type":"CatalogHandle","help":"Catalog handle — materialized tables must target a managed catalog","readOnlyInForm":true},
      {"name":"name","required":true,"inputKind":"string","type":"string","help":"Table name for the materialized table","readOnlyInForm":false},
      {"name":"bucketing","required":false,"inputKind":"object","type":"{ readonly columns: readonly string[]; readonly count: number; }","help":"Bucketing configuration (Flink 2.2+ only)","readOnlyInForm":true},
      {"name":"columns","required":false,"inputKind":"object","type":"Record","help":"Explicit column definitions, emitted as a column list on the\n`CREATE MATERIALIZED TABLE name (...)` clause. Maps column name → Flink\nSQL type. Flink 2.3+ only (FLIP-550). When omitted, the schema is inferred\nfrom the defining query (the pre-2.3 behavior).","readOnlyInForm":true},
      {"name":"comment","required":false,"inputKind":"string","type":"string","help":"Human-readable comment for the table","readOnlyInForm":false},
      {"name":"database","required":false,"inputKind":"string","type":"string","help":"Database within the catalog (uses catalog default if omitted)","readOnlyInForm":false},
      {"name":"freshness","required":false,"inputKind":"string","type":"string","help":"Freshness interval, e.g. \"INTERVAL '30' SECOND\". Required for Flink < 2.2.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"partitionedBy","required":false,"inputKind":"array","type":"readonly string[]","help":"Partition columns","readOnlyInForm":false},
      {"name":"primaryKey","required":false,"inputKind":"array","type":"readonly string[]","help":"Primary key column(s) → `PRIMARY KEY (...) NOT ENFORCED`. Flink 2.3+ (FLIP-550).","readOnlyInForm":false},
      {"name":"refreshMode","required":false,"inputKind":"enum","type":"\"full\" | \"continuous\" | \"automatic\"","options":["full","continuous","automatic"],"help":"Refresh mode: continuous streaming, periodic full refresh, or automatic (Flink decides)","readOnlyInForm":false},
      {"name":"startMode","required":false,"inputKind":"object","type":"\"FROM_BEGINNING\" | \"FROM_NOW\" | \"RESUME_OR_FROM_BEGINNING\" | \"RESUME_OR_FROM_NOW\" | { readonly mode: \"FROM_TIMESTAMP\" | \"RESUME_OR_FROM_TIMESTAMP\"; readonly timestamp: string; }","help":"Data-reprocessing start mode (Flink 2.3+, FLIP-557). Controls how the\nrefresh job seeds historical data: replay from the beginning, start from\nnow, or start from an explicit timestamp.","readOnlyInForm":true},
      {"name":"watermark","required":false,"inputKind":"object","type":"{ readonly column: string; readonly expression: string; }","help":"Watermark spec → `WATERMARK FOR <column> AS <expression>`. Flink 2.3+ (FLIP-550).","readOnlyInForm":true},
      {"name":"with","required":false,"inputKind":"object","type":"Record","help":"Table options (WITH clause)","readOnlyInForm":true},
    ],
  },
  "PaimonCatalog": {
    component: "PaimonCatalog",
    runtimeRequired: [],
    fields: [
      {"name":"name","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"warehouse","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"metastore","required":false,"inputKind":"enum","type":"\"hive\" | \"filesystem\"","options":["hive","filesystem"],"readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"s3AccessKey","required":false,"inputKind":"string","type":"string","help":"S3 access/secret keys are passed as plain strings: SQL `CREATE CATALOG`\nDDL is sent verbatim to the gateway, and Flink does not resolve\n`${env:VAR}` placeholders inside catalog options. For real deployments,\ninject the value at synth time via `process.env.S3_KEY` rather than a\n`secretRef()`.","readOnlyInForm":false},
      {"name":"s3Endpoint","required":false,"inputKind":"string","type":"string","help":"S3 endpoint for `s3a://`/`s3://` warehouses (e.g. `http://seaweedfs:8333`).\nRequired when using a non-AWS S3-compatible store; without it Paimon\ndefaults to AWS endpoints. Ignored when warehouse uses `file://` etc.","readOnlyInForm":false},
      {"name":"s3PathStyleAccess","required":false,"inputKind":"boolean","type":"boolean","help":"Whether to use path-style addressing (`http://endpoint/bucket/key`)\ninstead of virtual-hosted-style (`http://bucket.endpoint/key`).\nRequired for SeaweedFS, MinIO, and most non-AWS S3 stores.","readOnlyInForm":false},
      {"name":"s3SecretKey","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
    ],
  },
  "PaimonSink": {
    component: "PaimonSink",
    runtimeRequired: [],
    fields: [
      {"name":"catalog","required":true,"inputKind":"object","type":"CatalogHandle","readOnlyInForm":true},
      {"name":"database","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"table","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"bucket","required":false,"inputKind":"number","type":"number","help":"Number of buckets (Paimon `bucket` table option). The single most\nimportant throughput knob — match this to writer parallelism. The\nPaimon default of `-1` (dynamic) serializes writers and is rarely the\nright choice for production CDC.","readOnlyInForm":false},
      {"name":"bucketKey","required":false,"inputKind":"array","type":"readonly string[]","help":"Bucket-key columns (`bucket-key` table option). Defaults to\n`primaryKey` when set; provide an explicit value to bucket on a\nnon-PK column (e.g. `customer_region` while the PK is `order_id`).","readOnlyInForm":false},
      {"name":"changelogProducer","required":false,"inputKind":"enum","type":"PaimonChangelogProducer","options":["input","lookup","full-compaction"],"readOnlyInForm":false},
      {"name":"fullCompactionDeltaCommits","required":false,"inputKind":"number","type":"number","help":"Number of incremental commits between forced full compactions\n(`full-compaction.delta-commits`). Lower values keep query latency\npredictable at the cost of write amplification.","readOnlyInForm":false},
      {"name":"mergeEngine","required":false,"inputKind":"enum","type":"PaimonMergeEngine","options":["deduplicate","partial-update","aggregation","first-row"],"readOnlyInForm":false},
      {"name":"onConflict","required":false,"inputKind":"enum","type":"\"DO NOTHING\" | \"DO ERROR\" | \"DO DEDUPLICATE\"","options":["DO NOTHING","DO ERROR","DO DEDUPLICATE"],"help":"Upsert conflict strategy → trailing `ON CONFLICT DO …` clause on the\ngenerated INSERT (Flink 2.3+, FLIP-558).","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"primaryKey","required":false,"inputKind":"array","type":"readonly string[]","readOnlyInForm":false},
      {"name":"sequenceField","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"snapshotNumRetainedMax","required":false,"inputKind":"number","type":"number","help":"Snapshot retention ceiling (`snapshot.num-retained.max`).","readOnlyInForm":false},
      {"name":"snapshotNumRetainedMin","required":false,"inputKind":"number","type":"number","help":"Snapshot retention floor (`snapshot.num-retained.min`).","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this sink","readOnlyInForm":true},
      {"name":"writeBufferSizeMB","required":false,"inputKind":"number","type":"number","help":"In-memory write buffer size, in MB (`write-buffer-size`). Pairs with\n`bucket` to bound the small-file rate.","readOnlyInForm":false},
    ],
  },
  "Pipeline": {
    component: "Pipeline",
    runtimeRequired: [],
    fields: [
      {"name":"name","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"checkpoint","required":false,"inputKind":"object","type":"CheckpointConfig","readOnlyInForm":true},
      {"name":"flinkConfig","required":false,"inputKind":"object","type":"Record","readOnlyInForm":true},
      {"name":"mode","required":false,"inputKind":"enum","type":"PipelineMode","options":["streaming","batch"],"readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"restartStrategy","required":false,"inputKind":"object","type":"RestartStrategy","readOnlyInForm":true},
      {"name":"stateBackend","required":false,"inputKind":"enum","type":"StateBackend","options":["hashmap","rocksdb"],"readOnlyInForm":false},
      {"name":"stateTtl","required":false,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"telemetry","required":false,"inputKind":"object","type":"TelemetryConfig","readOnlyInForm":true},
      {"name":"upgradeStrategy","required":false,"inputKind":"object","type":"UpgradeStrategy","readOnlyInForm":true},
    ],
  },
  "Qualify": {
    component: "Qualify",
    runtimeRequired: [],
    fields: [
      {"name":"condition","required":true,"inputKind":"string","type":"string","help":"SQL expression filtering on a window function alias, e.g. \"rn = 1\"","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"window","required":false,"inputKind":"string","type":"string","help":"Optional window function expression to add to the SELECT list","readOnlyInForm":false},
    ],
  },
  "Query": {
    component: "Query",
    runtimeRequired: [],
    fields: [
      {"name":"outputSchema","required":true,"inputKind":"object","type":"SchemaDefinition<Record<string, FlinkType>>","help":"Schema describing the output of the query","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Query.GroupBy": {
    component: "Query.GroupBy",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"array","type":"readonly string[]","help":"Columns to group by","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Query.Having": {
    component: "Query.Having",
    runtimeRequired: [],
    fields: [
      {"name":"condition","required":true,"inputKind":"string","type":"string","help":"SQL HAVING condition","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Query.OrderBy": {
    component: "Query.OrderBy",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"object","type":"Record","help":"Column -> sort direction","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Query.Select": {
    component: "Query.Select",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"object","type":"Record","help":"Output alias -> expression or WindowFunctionExpr","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"windows","required":false,"inputKind":"object","type":"Record","help":"Named window definitions","readOnlyInForm":true},
    ],
  },
  "Query.Where": {
    component: "Query.Where",
    runtimeRequired: [],
    fields: [
      {"name":"condition","required":true,"inputKind":"string","type":"string","help":"SQL WHERE condition","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "RawSQL": {
    component: "RawSQL",
    runtimeRequired: [],
    fields: [
      {"name":"outputSchema","required":true,"inputKind":"object","type":"SchemaDefinition<Record<string, FlinkType>>","help":"Schema describing the output of the raw SQL","readOnlyInForm":true},
      {"name":"sql","required":true,"inputKind":"string","type":"string","help":"Arbitrary SQL string to inline as a subquery","readOnlyInForm":false},
      {"name":"inputs","required":false,"inputKind":"object","type":"readonly ConstructNode[]","help":"Input streams referenced by name in the SQL body. Optional: omit when\nthe SQL is self-contained (e.g. a `VALUES` literal). When `<RawSQL>`\nsits in a sibling chain, the preceding sibling becomes the implicit\nupstream — so `inputs` is only needed for fan-in (RawSQL referencing\ntwo or more named sources at once that aren't already in the chain).","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Rename": {
    component: "Rename",
    runtimeRequired: [],
    fields: [
      {"name":"columns","required":true,"inputKind":"object","type":"Record","help":"Record mapping current field names to new field names: { currentName: 'newName' }","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Route": {
    component: "Route",
    runtimeRequired: [],
    fields: [
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Route.Branch": {
    component: "Route.Branch",
    runtimeRequired: [],
    fields: [
      {"name":"condition","required":true,"inputKind":"string","type":"string","help":"SQL condition expression for this branch","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Route.Default": {
    component: "Route.Default",
    runtimeRequired: [],
    fields: [
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "SessionWindow": {
    component: "SessionWindow",
    runtimeRequired: [],
    fields: [
      {"name":"gap","required":true,"inputKind":"string","type":"string","help":"Inactivity gap duration (e.g. \"30 minutes\")","readOnlyInForm":false},
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"Time attribute column for the window","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this window","readOnlyInForm":true},
    ],
  },
  "SideOutput": {
    component: "SideOutput",
    runtimeRequired: [],
    fields: [
      {"name":"condition","required":true,"inputKind":"string","type":"string","help":"SQL predicate — matching records go to side sink","readOnlyInForm":false},
      {"name":"outputSchema","required":false,"inputKind":"object","type":"SchemaDefinition<Record<string, FlinkType>>","help":"Schema for side output (defaults to input + metadata)","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tag","required":false,"inputKind":"string","type":"string","help":"Label injected as `_side_tag` column in side output","readOnlyInForm":false},
    ],
  },
  "SideOutput.Sink": {
    component: "SideOutput.Sink",
    runtimeRequired: [],
    fields: [
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "SlideWindow": {
    component: "SlideWindow",
    runtimeRequired: [],
    fields: [
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"Time attribute column for the window","readOnlyInForm":false},
      {"name":"size","required":true,"inputKind":"string","type":"string","help":"Window size duration (e.g. \"1 hour\")","readOnlyInForm":false},
      {"name":"slide","required":true,"inputKind":"string","type":"string","help":"Slide interval (e.g. \"15 minutes\")","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this window","readOnlyInForm":true},
    ],
  },
  "TemporalJoin": {
    component: "TemporalJoin",
    runtimeRequired: [],
    fields: [
      {"name":"asOf","required":true,"inputKind":"string","type":"string","help":"Time attribute column for FOR SYSTEM_TIME AS OF","readOnlyInForm":false},
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"SQL join condition","readOnlyInForm":false},
      {"name":"stream","required":true,"inputKind":"object","type":"ConstructNode","help":"The driving stream","readOnlyInForm":true},
      {"name":"temporal","required":true,"inputKind":"object","type":"ConstructNode","help":"The versioned table stream","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this join","readOnlyInForm":true},
    ],
  },
  "TopN": {
    component: "TopN",
    runtimeRequired: [],
    fields: [
      {"name":"n","required":true,"inputKind":"number","type":"number","help":"Number of top rows to keep per partition","readOnlyInForm":false},
      {"name":"orderBy","required":true,"inputKind":"object","type":"Record","help":"Ordering specification: field name → ASC or DESC","readOnlyInForm":true},
      {"name":"partitionBy","required":true,"inputKind":"array","type":"readonly string[]","help":"Fields to partition the ranking by","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "TumbleWindow": {
    component: "TumbleWindow",
    runtimeRequired: [],
    fields: [
      {"name":"on","required":true,"inputKind":"string","type":"string","help":"Time attribute column for the window","readOnlyInForm":false},
      {"name":"size","required":true,"inputKind":"string","type":"string","help":"Window size duration (e.g. \"1 hour\", \"5 minutes\")","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this window","readOnlyInForm":true},
    ],
  },
  "UDF": {
    component: "UDF",
    runtimeRequired: [],
    fields: [
      {"name":"className","required":true,"inputKind":"string","type":"string","help":"Fully-qualified Java/Scala class implementing the function","readOnlyInForm":false},
      {"name":"jarPath","required":true,"inputKind":"string","type":"string","help":"Path to the JAR containing the UDF class","readOnlyInForm":false},
      {"name":"name","required":true,"inputKind":"string","type":"string","help":"Function name to register in Flink","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Union": {
    component: "Union",
    runtimeRequired: [],
    fields: [
      {"name":"inputs","required":false,"inputKind":"object","type":"readonly SchemaDefinition<Record<string, FlinkType>>[]","help":"Input schemas to validate compatibility (set by the framework during synthesis)","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this transform","readOnlyInForm":true},
    ],
  },
  "Validate": {
    component: "Validate",
    runtimeRequired: [],
    fields: [
      {"name":"rules","required":true,"inputKind":"object","type":"ValidationRules","help":"Validation rules — notNull, range, and/or expression","readOnlyInForm":true},
      {"name":"outputSchema","required":false,"inputKind":"object","type":"SchemaDefinition<Record<string, FlinkType>>","help":"Schema of valid output","readOnlyInForm":true},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "Validate.Reject": {
    component: "Validate.Reject",
    runtimeRequired: [],
    fields: [
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "View": {
    component: "View",
    runtimeRequired: [],
    fields: [
      {"name":"name","required":true,"inputKind":"string","type":"string","help":"View name (used as table reference in downstream `from` props)","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
    ],
  },
  "YugabyteCdcSource": {
    component: "YugabyteCdcSource",
    runtimeRequired: ["hostname","username","password","database","table","schema"],
    fields: [
      {"name":"database","required":true,"inputKind":"string","type":"string","help":"Postgres database → `'database-name'`.","readOnlyInForm":false},
      {"name":"hostname","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"password","required":true,"inputKind":"object","type":"SecretRef","help":"Secret reference for the password. A plain string is rejected at compile\ntime — use `secretRef(...)`. Rendered as a `${env:<envName>}` placeholder\nin the WITH clause; the runtime adapters substitute it before submission\n(the docker adapter inlines from the host env, the kubernetes adapter binds\na `secretKeyRef` env in the FlinkDeployment podTemplate).","readOnlyInForm":true},
      {"name":"schema","required":true,"inputKind":"object","type":"SchemaDefinition<T>","help":"The Flink table column schema (+ optional PK / watermark / metadata columns).","readOnlyInForm":true},
      {"name":"table","required":true,"inputKind":"string","type":"string","help":"Postgres table → `'table-name'`.","readOnlyInForm":false},
      {"name":"username","required":true,"inputKind":"string","type":"string","readOnlyInForm":false},
      {"name":"decodingPluginName","required":false,"inputKind":"string","type":"string","help":"Logical-decoding plugin → `'decoding.plugin.name'`. Defaults to `'pgoutput'`,\nwhich YugabyteDB requires — its CDC fork does not support the upstream\ndefault (`decoderbufs`).","readOnlyInForm":false},
      {"name":"name","required":false,"inputKind":"string","type":"string","help":"Optional SQL table name. Defaults to the Yugabyte table name.","readOnlyInForm":false},
      {"name":"parallelism","required":false,"inputKind":"number","type":"number","readOnlyInForm":false},
      {"name":"port","required":false,"inputKind":"number","type":"number","help":"Defaults to `5433` — the YugabyteDB YSQL tserver port (NOT Postgres 5432).","readOnlyInForm":false},
      {"name":"primaryKey","required":false,"inputKind":"array","type":"readonly string[]","help":"Explicit PK hint; overrides `schema.primaryKey`. postgres-cdc requires a PK.","readOnlyInForm":false},
      {"name":"schemaName","required":false,"inputKind":"string","type":"string","help":"Postgres schema → `'schema-name'`. Defaults to `'public'`.","readOnlyInForm":false},
      {"name":"slotName","required":false,"inputKind":"string","type":"string","help":"Logical replication slot → `'slot.name'`. Defaults to `'flink'`.","readOnlyInForm":false},
      {"name":"snapshotMode","required":false,"inputKind":"string","type":"string","help":"Optional → `'debezium.snapshot.mode'` (e.g. `'never'` to skip the initial snapshot).","readOnlyInForm":false},
      {"name":"sslMode","required":false,"inputKind":"string","type":"string","help":"Optional → `'debezium.database.sslmode'` (e.g. `'require'` for TLS).","readOnlyInForm":false},
      {"name":"tap","required":false,"inputKind":"object","type":"boolean | TapConfig","help":"Enable operator tailing for this source.","readOnlyInForm":true},
    ],
  },
}
