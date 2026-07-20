// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Build-time projection of the DSL's typed component prop interfaces, produced
// by `scripts/generate-prop-metadata.ts`. Connector-property and enum-value
// completions read this table so they never drift from the DSL types. A parity
// test guards coverage against the component inventory.
//
// Regenerate: pnpm --filter @flink-reactor/language-server gen:prop-metadata

/** A single projected component prop. */
export interface PropMeta {
  /** Prop (attribute) name. */
  readonly name: string
  /** True when the prop interface declares it without `?`. */
  readonly required: boolean
  /** Human-readable type string (from the TypeScript checker). */
  readonly type: string
  /** Present iff the (alias-resolved) type is a union of string literals. */
  readonly enumValues?: readonly string[]
  /** JSDoc summary, when the interface documents the prop. */
  readonly doc?: string
}

/** component name → its props (required first, then alphabetical). */
export const PROP_METADATA: Record<string, readonly PropMeta[]> = {
  "AddField": [
    {"name":"columns","required":true,"type":"Record","doc":"Record mapping new field names to SQL expressions: { newFieldName: 'sqlExpr' }"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"types","required":false,"type":"Record","doc":"Optional type hints for the new fields: { newFieldName: 'BIGINT' }"},
  ],
  "Aggregate": [
    {"name":"groupBy","required":true,"type":"readonly string[]","doc":"Fields to group by"},
    {"name":"select","required":true,"type":"Record","doc":"Record mapping output fields to aggregate expressions (e.g. 'COUNT(*)', 'SUM(amount)')"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "Cast": [
    {"name":"columns","required":true,"type":"Record","doc":"Record mapping field names to target Flink SQL types: { fieldName: 'BIGINT' }"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"safe","required":false,"type":"boolean","doc":"Use TRY_CAST instead of CAST (default: false)"},
  ],
  "CatalogSource": [
    {"name":"catalog","required":true,"type":"CatalogHandle"},
    {"name":"database","required":true,"type":"string"},
    {"name":"table","required":true,"type":"string"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Coalesce": [
    {"name":"columns","required":true,"type":"Record","doc":"Record mapping field names to default SQL expressions: { fieldName: 'defaultExpr' }"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Deduplicate": [
    {"name":"keep","required":true,"type":"\"first\" | \"last\"","enumValues":["first","last"],"doc":"Keep the first or last row per key"},
    {"name":"key","required":true,"type":"readonly string[]","doc":"Fields forming the deduplication key"},
    {"name":"order","required":true,"type":"string","doc":"Field to order by for selecting which row to keep"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "Drop": [
    {"name":"columns","required":true,"type":"readonly string[]","doc":"Field names to exclude from the output"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "FileSystemSink": [
    {"name":"path","required":true,"type":"string"},
    {"name":"format","required":false,"type":"FileFormat","enumValues":["parquet","orc","csv","json"]},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to the last path segment."},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"partitionBy","required":false,"type":"readonly string[]"},
    {"name":"rollingPolicy","required":false,"type":"RollingPolicy"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this sink"},
  ],
  "Filter": [
    {"name":"condition","required":true,"type":"string","doc":"SQL WHERE expression (e.g. \"amount > 100 AND status = 'active'\")"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "FlatMap": [
    {"name":"as","required":true,"type":"Record","doc":"Output field schema for the unnested elements"},
    {"name":"unnest","required":true,"type":"string","doc":"Field name to expand (array or map column)"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "GenericCatalog": [
    {"name":"name","required":true,"type":"string"},
    {"name":"type","required":true,"type":"string"},
    {"name":"options","required":false,"type":"Record"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "GenericSink": [
    {"name":"connector","required":true,"type":"string"},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to the connector name."},
    {"name":"options","required":false,"type":"Record"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this sink"},
  ],
  "GenericSource": [
    {"name":"connector","required":true,"type":"string"},
    {"name":"schema","required":true,"type":"SchemaDefinition<T>"},
    {"name":"format","required":false,"type":"string"},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to the connector name."},
    {"name":"options","required":false,"type":"Record"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this source"},
  ],
  "HiveCatalog": [
    {"name":"hiveConfDir","required":true,"type":"string"},
    {"name":"name","required":true,"type":"string"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "IcebergCatalog": [
    {"name":"catalogType","required":true,"type":"IcebergCatalogType","enumValues":["hive","hadoop","rest"]},
    {"name":"name","required":true,"type":"string"},
    {"name":"uri","required":true,"type":"string"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"warehouse","required":false,"type":"string","doc":"Warehouse identifier passed to the catalog server. Required by REST\ncatalogs that host multiple warehouses (e.g. Lakekeeper) — the value is\nthe registered warehouse name there. Optional for single-warehouse\nservers (e.g. tabulario/iceberg-rest)."},
  ],
  "IcebergSink": [
    {"name":"catalog","required":true,"type":"CatalogHandle"},
    {"name":"database","required":true,"type":"string"},
    {"name":"table","required":true,"type":"string"},
    {"name":"commitIntervalSeconds","required":false,"type":"number","doc":"Iceberg writer flush cadence. Maps to `commit-interval-ms` (×1000).\n\nRecommended defaults for CDC workloads:\n  • 10s — throughput-oriented runs\n  • 2–5s — latency-oriented runs"},
    {"name":"equalityFieldColumns","required":false,"type":"readonly string[]","doc":"Columns that drive Iceberg equality-delete writes for MoR.\nDeclared independently from `primaryKey`: in practice they are usually\nthe same set, but Iceberg treats them as two distinct concepts and\nwithout at least one of them set, `upsertEnabled: true` cannot produce\nreal row-level deletes (falls back to position-only deletes).\n\nWhen omitted but `primaryKey` is set, synthesis derives the Iceberg\n`equality-field-columns` entry from `primaryKey`."},
    {"name":"formatVersion","required":false,"type":"1 | 2"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"primaryKey","required":false,"type":"readonly string[]"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this sink"},
    {"name":"targetFileSizeMB","required":false,"type":"number","doc":"Target size per data file in MB. Maps to `write.target-file-size-bytes`\n(×1048576). Pair with `writeDistributionMode` to bound write-amplification.\n\nRecommended defaults: 256 for snapshot backfills, 64 for steady-state live."},
    {"name":"upsertEnabled","required":false,"type":"boolean"},
    {"name":"writeDistributionMode","required":false,"type":"IcebergWriteDistributionMode","enumValues":["none","hash","range"],"doc":"Partition-aware write routing. Maps to `write.distribution-mode`.\n\nUse `'hash'` under any non-trivial parallelism to avoid small-file\nexplosion; `'none'` + `parallelism > 1` emits a synthesis warning."},
    {"name":"writeParquetCompression","required":false,"type":"IcebergParquetCompression","enumValues":["none","zstd","snappy","gzip"],"doc":"Parquet codec. Maps to `write.parquet.compression-codec`.\n`'zstd'` is the defensible default for CDC workloads."},
  ],
  "IntervalJoin": [
    {"name":"interval","required":true,"type":"IntervalBounds","doc":"Time interval bounds for the join window"},
    {"name":"left","required":true,"type":"ConstructNode","doc":"Left input stream"},
    {"name":"on","required":true,"type":"string","doc":"SQL join condition"},
    {"name":"right","required":true,"type":"ConstructNode","doc":"Right input stream"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this join"},
    {"name":"type","required":false,"type":"\"inner\" | \"left\" | \"right\" | \"full\"","enumValues":["inner","left","right","full"],"doc":"Join type (default: 'inner')"},
  ],
  "JdbcCatalog": [
    {"name":"baseUrl","required":true,"type":"string"},
    {"name":"defaultDatabase","required":true,"type":"string"},
    {"name":"name","required":true,"type":"string"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "JdbcSink": [
    {"name":"table","required":true,"type":"string"},
    {"name":"url","required":true,"type":"string"},
    {"name":"keyFields","required":false,"type":"readonly string[]"},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to the JDBC table name."},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this sink"},
    {"name":"upsertMode","required":false,"type":"boolean"},
  ],
  "JdbcSource": [
    {"name":"schema","required":true,"type":"SchemaDefinition<T>"},
    {"name":"table","required":true,"type":"string"},
    {"name":"url","required":true,"type":"string"},
    {"name":"lookupCache","required":false,"type":"LookupCacheConfig"},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to the JDBC table name."},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this source"},
  ],
  "Join": [
    {"name":"left","required":true,"type":"ConstructNode","doc":"Left input stream (construct node)"},
    {"name":"on","required":true,"type":"string","doc":"SQL join condition (e.g. \"a.user_id = b.user_id\")"},
    {"name":"right","required":true,"type":"ConstructNode","doc":"Right input stream (construct node)"},
    {"name":"hints","required":false,"type":"JoinHints","doc":"Query hints for join optimization"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"stateTtl","required":false,"type":"string","doc":"State TTL for join state expiry (e.g. '1h', '30min')"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this join"},
    {"name":"type","required":false,"type":"JoinType","enumValues":["inner","left","right","full","anti","semi"],"doc":"Join type (default: 'inner')"},
  ],
  "KafkaSink": [
    {"name":"topic","required":true,"type":"string"},
    {"name":"bootstrapServers","required":false,"type":"string"},
    {"name":"format","required":false,"type":"SinkFormat","enumValues":["csv","json","avro","debezium-json","debezium-avro","debezium-protobuf","canal-json"]},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to topic name normalized as a SQL identifier."},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"schemaRegistryUrl","required":false,"type":"string","doc":"Confluent Schema Registry URL. Required when `format` is `\"debezium-avro\"`\nor `\"debezium-protobuf\"`."},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this sink"},
  ],
  "KafkaSource": [
    {"name":"schema","required":true,"type":"SchemaDefinition<T>"},
    {"name":"topic","required":true,"type":"string"},
    {"name":"bootstrapServers","required":false,"type":"string"},
    {"name":"consumerGroup","required":false,"type":"string"},
    {"name":"format","required":false,"type":"KafkaFormat","enumValues":["csv","json","avro","debezium-json","debezium-avro","debezium-protobuf","canal-json","maxwell-json"]},
    {"name":"name","required":false,"type":"string","doc":"Optional SQL table name. Defaults to topic name normalized as a SQL identifier."},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"primaryKey","required":false,"type":"readonly string[]"},
    {"name":"schemaRegistryUrl","required":false,"type":"string","doc":"Confluent Schema Registry URL. Required when `format` is `\"debezium-avro\"`\nor `\"debezium-protobuf\"` — the Flink deserializer fetches the writer schema\nfrom this endpoint at runtime. The deployment template must expose a\nreachable Schema Registry (in-cluster sidecar or external endpoint); see\nthe Confluent `flink-sql-avro-confluent-registry` /\n`flink-sql-protobuf-confluent-registry` format docs for the request shape."},
    {"name":"startupMode","required":false,"type":"KafkaStartupMode","enumValues":["latest-offset","earliest-offset","group-offsets","timestamp"]},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this source"},
    {"name":"watermark","required":false,"type":"WatermarkDeclaration"},
  ],
  "LateralJoin": [
    {"name":"args","required":true,"type":"readonly (string | number)[]","doc":"Arguments passed to the TVF (column refs or literals)"},
    {"name":"as","required":true,"type":"Record","doc":"Output column names and types from the TVF"},
    {"name":"function","required":true,"type":"string","doc":"TVF name (registered via UDF or built-in like VECTOR_SEARCH)"},
    {"name":"input","required":true,"type":"ConstructNode","doc":"Upstream stream to join against"},
    {"name":"outputSchema","required":false,"type":"SchemaDefinition<Record<string, FlinkType>>","doc":"Schema of the combined output"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"type","required":false,"type":"\"left\" | \"cross\"","enumValues":["left","cross"],"doc":"Join type: 'cross' (default) or 'left'"},
  ],
  "LookupJoin": [
    {"name":"input","required":true,"type":"ConstructNode","doc":"The driving input stream"},
    {"name":"on","required":true,"type":"string","doc":"SQL join condition"},
    {"name":"table","required":true,"type":"string","doc":"Dimension table name"},
    {"name":"url","required":true,"type":"string","doc":"JDBC connection URL for the dimension table"},
    {"name":"async","required":false,"type":"LookupAsyncConfig","doc":"Async lookup configuration"},
    {"name":"cache","required":false,"type":"LookupCacheConfig$1","doc":"Lookup cache configuration"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"select","required":false,"type":"Record","doc":"Output field mapping"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this join"},
  ],
  "Map": [
    {"name":"select","required":true,"type":"Record","doc":"Record mapping output field names to SQL expressions"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "MatchRecognize": [
    {"name":"define","required":true,"type":"Record","doc":"Map of pattern variable → boolean SQL condition"},
    {"name":"input","required":true,"type":"ConstructNode","doc":"Input stream to match patterns against"},
    {"name":"measures","required":true,"type":"Record","doc":"Map of output column name → SQL expression using pattern variables"},
    {"name":"pattern","required":true,"type":"string","doc":"Row-pattern string using pattern variables (e.g. 'A B+ C')"},
    {"name":"after","required":false,"type":"MatchAfterStrategy","enumValues":["MATCH_RECOGNIZED","NEXT_ROW"],"doc":"Match strategy after a match is found"},
    {"name":"orderBy","required":false,"type":"string","doc":"Field to order the input by (required for event ordering)"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"partitionBy","required":false,"type":"readonly string[]","doc":"Fields to partition the input by before matching"},
  ],
  "MaterializedTable": [
    {"name":"catalog","required":true,"type":"CatalogHandle","doc":"Catalog handle — materialized tables must target a managed catalog"},
    {"name":"name","required":true,"type":"string","doc":"Table name for the materialized table"},
    {"name":"bucketing","required":false,"type":"{ readonly columns: readonly string[]; readonly count: number; }","doc":"Bucketing configuration (Flink 2.2+ only)"},
    {"name":"comment","required":false,"type":"string","doc":"Human-readable comment for the table"},
    {"name":"database","required":false,"type":"string","doc":"Database within the catalog (uses catalog default if omitted)"},
    {"name":"freshness","required":false,"type":"string","doc":"Freshness interval, e.g. \"INTERVAL '30' SECOND\". Required for Flink < 2.2."},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"partitionedBy","required":false,"type":"readonly string[]","doc":"Partition columns"},
    {"name":"refreshMode","required":false,"type":"\"full\" | \"continuous\" | \"automatic\"","enumValues":["full","continuous","automatic"],"doc":"Refresh mode: continuous streaming, periodic full refresh, or automatic (Flink decides)"},
    {"name":"with","required":false,"type":"Record","doc":"Table options (WITH clause)"},
  ],
  "PaimonCatalog": [
    {"name":"name","required":true,"type":"string"},
    {"name":"warehouse","required":true,"type":"string"},
    {"name":"metastore","required":false,"type":"\"hive\" | \"filesystem\"","enumValues":["hive","filesystem"]},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"s3AccessKey","required":false,"type":"string","doc":"S3 access/secret keys are passed as plain strings: SQL `CREATE CATALOG`\nDDL is sent verbatim to the gateway, and Flink does not resolve\n`${env:VAR}` placeholders inside catalog options. For real deployments,\ninject the value at synth time via `process.env.S3_KEY` rather than a\n`secretRef()`."},
    {"name":"s3Endpoint","required":false,"type":"string","doc":"S3 endpoint for `s3a://`/`s3://` warehouses (e.g. `http://seaweedfs:8333`).\nRequired when using a non-AWS S3-compatible store; without it Paimon\ndefaults to AWS endpoints. Ignored when warehouse uses `file://` etc."},
    {"name":"s3PathStyleAccess","required":false,"type":"boolean","doc":"Whether to use path-style addressing (`http://endpoint/bucket/key`)\ninstead of virtual-hosted-style (`http://bucket.endpoint/key`).\nRequired for SeaweedFS, MinIO, and most non-AWS S3 stores."},
    {"name":"s3SecretKey","required":false,"type":"string"},
  ],
  "PaimonSink": [
    {"name":"catalog","required":true,"type":"CatalogHandle"},
    {"name":"database","required":true,"type":"string"},
    {"name":"table","required":true,"type":"string"},
    {"name":"bucket","required":false,"type":"number","doc":"Number of buckets (Paimon `bucket` table option). The single most\nimportant throughput knob — match this to writer parallelism. The\nPaimon default of `-1` (dynamic) serializes writers and is rarely the\nright choice for production CDC."},
    {"name":"bucketKey","required":false,"type":"readonly string[]","doc":"Bucket-key columns (`bucket-key` table option). Defaults to\n`primaryKey` when set; provide an explicit value to bucket on a\nnon-PK column (e.g. `customer_region` while the PK is `order_id`)."},
    {"name":"changelogProducer","required":false,"type":"PaimonChangelogProducer","enumValues":["input","lookup","full-compaction"]},
    {"name":"fullCompactionDeltaCommits","required":false,"type":"number","doc":"Number of incremental commits between forced full compactions\n(`full-compaction.delta-commits`). Lower values keep query latency\npredictable at the cost of write amplification."},
    {"name":"mergeEngine","required":false,"type":"PaimonMergeEngine","enumValues":["deduplicate","partial-update","aggregation","first-row"]},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"primaryKey","required":false,"type":"readonly string[]"},
    {"name":"sequenceField","required":false,"type":"string"},
    {"name":"snapshotNumRetainedMax","required":false,"type":"number","doc":"Snapshot retention ceiling (`snapshot.num-retained.max`)."},
    {"name":"snapshotNumRetainedMin","required":false,"type":"number","doc":"Snapshot retention floor (`snapshot.num-retained.min`)."},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this sink"},
    {"name":"writeBufferSizeMB","required":false,"type":"number","doc":"In-memory write buffer size, in MB (`write-buffer-size`). Pairs with\n`bucket` to bound the small-file rate."},
  ],
  "Pipeline": [
    {"name":"name","required":true,"type":"string"},
    {"name":"checkpoint","required":false,"type":"CheckpointConfig"},
    {"name":"flinkConfig","required":false,"type":"Record"},
    {"name":"mode","required":false,"type":"PipelineMode","enumValues":["streaming","batch"]},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"restartStrategy","required":false,"type":"RestartStrategy"},
    {"name":"stateBackend","required":false,"type":"StateBackend","enumValues":["hashmap","rocksdb"]},
    {"name":"stateTtl","required":false,"type":"string"},
    {"name":"upgradeStrategy","required":false,"type":"UpgradeStrategy"},
  ],
  "Qualify": [
    {"name":"condition","required":true,"type":"string","doc":"SQL expression filtering on a window function alias, e.g. \"rn = 1\""},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"window","required":false,"type":"string","doc":"Optional window function expression to add to the SELECT list"},
  ],
  "Query": [
    {"name":"outputSchema","required":true,"type":"SchemaDefinition<Record<string, FlinkType>>","doc":"Schema describing the output of the query"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Query.GroupBy": [
    {"name":"columns","required":true,"type":"readonly string[]","doc":"Columns to group by"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Query.Having": [
    {"name":"condition","required":true,"type":"string","doc":"SQL HAVING condition"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Query.OrderBy": [
    {"name":"columns","required":true,"type":"Record","doc":"Column -> sort direction"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Query.Select": [
    {"name":"columns","required":true,"type":"Record","doc":"Output alias -> expression or WindowFunctionExpr"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"windows","required":false,"type":"Record","doc":"Named window definitions"},
  ],
  "Query.Where": [
    {"name":"condition","required":true,"type":"string","doc":"SQL WHERE condition"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "RawSQL": [
    {"name":"outputSchema","required":true,"type":"SchemaDefinition<Record<string, FlinkType>>","doc":"Schema describing the output of the raw SQL"},
    {"name":"sql","required":true,"type":"string","doc":"Arbitrary SQL string to inline as a subquery"},
    {"name":"inputs","required":false,"type":"readonly ConstructNode[]","doc":"Input streams referenced by name in the SQL body. Optional: omit when\nthe SQL is self-contained (e.g. a `VALUES` literal). When `<RawSQL>`\nsits in a sibling chain, the preceding sibling becomes the implicit\nupstream — so `inputs` is only needed for fan-in (RawSQL referencing\ntwo or more named sources at once that aren't already in the chain)."},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Rename": [
    {"name":"columns","required":true,"type":"Record","doc":"Record mapping current field names to new field names: { currentName: 'newName' }"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Route": [
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Route.Branch": [
    {"name":"condition","required":true,"type":"string","doc":"SQL condition expression for this branch"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Route.Default": [
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "SessionWindow": [
    {"name":"gap","required":true,"type":"string","doc":"Inactivity gap duration (e.g. \"30 minutes\")"},
    {"name":"on","required":true,"type":"string","doc":"Time attribute column for the window"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this window"},
  ],
  "SideOutput": [
    {"name":"condition","required":true,"type":"string","doc":"SQL predicate — matching records go to side sink"},
    {"name":"outputSchema","required":false,"type":"SchemaDefinition<Record<string, FlinkType>>","doc":"Schema for side output (defaults to input + metadata)"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tag","required":false,"type":"string","doc":"Label injected as `_side_tag` column in side output"},
  ],
  "SideOutput.Sink": [
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "SlideWindow": [
    {"name":"on","required":true,"type":"string","doc":"Time attribute column for the window"},
    {"name":"size","required":true,"type":"string","doc":"Window size duration (e.g. \"1 hour\")"},
    {"name":"slide","required":true,"type":"string","doc":"Slide interval (e.g. \"15 minutes\")"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this window"},
  ],
  "TemporalJoin": [
    {"name":"asOf","required":true,"type":"string","doc":"Time attribute column for FOR SYSTEM_TIME AS OF"},
    {"name":"on","required":true,"type":"string","doc":"SQL join condition"},
    {"name":"stream","required":true,"type":"ConstructNode","doc":"The driving stream"},
    {"name":"temporal","required":true,"type":"ConstructNode","doc":"The versioned table stream"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this join"},
  ],
  "TopN": [
    {"name":"n","required":true,"type":"number","doc":"Number of top rows to keep per partition"},
    {"name":"orderBy","required":true,"type":"Record","doc":"Ordering specification: field name → ASC or DESC"},
    {"name":"partitionBy","required":true,"type":"readonly string[]","doc":"Fields to partition the ranking by"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "TumbleWindow": [
    {"name":"on","required":true,"type":"string","doc":"Time attribute column for the window"},
    {"name":"size","required":true,"type":"string","doc":"Window size duration (e.g. \"1 hour\", \"5 minutes\")"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this window"},
  ],
  "UDF": [
    {"name":"className","required":true,"type":"string","doc":"Fully-qualified Java/Scala class implementing the function"},
    {"name":"jarPath","required":true,"type":"string","doc":"Path to the JAR containing the UDF class"},
    {"name":"name","required":true,"type":"string","doc":"Function name to register in Flink"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Union": [
    {"name":"inputs","required":false,"type":"readonly SchemaDefinition<Record<string, FlinkType>>[]","doc":"Input schemas to validate compatibility (set by the framework during synthesis)"},
    {"name":"parallelism","required":false,"type":"number"},
    {"name":"tap","required":false,"type":"boolean | TapConfig","doc":"Enable operator tailing for this transform"},
  ],
  "Validate": [
    {"name":"rules","required":true,"type":"ValidationRules","doc":"Validation rules — notNull, range, and/or expression"},
    {"name":"outputSchema","required":false,"type":"SchemaDefinition<Record<string, FlinkType>>","doc":"Schema of valid output"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "Validate.Reject": [
    {"name":"parallelism","required":false,"type":"number"},
  ],
  "View": [
    {"name":"name","required":true,"type":"string","doc":"View name (used as table reference in downstream `from` props)"},
    {"name":"parallelism","required":false,"type":"number"},
  ],
}
