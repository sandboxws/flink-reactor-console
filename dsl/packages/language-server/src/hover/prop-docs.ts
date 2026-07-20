// Curated connector-property documentation for hover.
//
// No machine-readable prop registry exists in the DSL — prop docs live only as
// TypeScript-interface JSDoc, which the ts-plugin already surfaces via plain-TS
// hover. This table is the synthesis-backed hover's own source of truth for the
// *connector* props (the `topic`/`table`/`path` family), authored from the
// component prop interfaces in `src/components/{sources,sinks}.ts`. Props absent
// here degrade gracefully to "no documented description" (or defer to the
// ts-plugin's TS hover) rather than guessing.
//
// SQL-expression props (`Filter.condition`, `Join.on`, `Map.select`, …) are NOT
// listed: `buildPropCard` recognizes them via the shared `EXPRESSION_PROPS` map
// and renders an expression-specific card instead.

export interface PropDoc {
  readonly description: string
  /** A human-readable type string (not a precise TS type). */
  readonly type: string
  /** Rendered default, when the prop has one. */
  readonly default?: string
  readonly required?: boolean
}

/** Props common to most connectors, merged in when a component omits them. */
const SHARED: Record<string, PropDoc> = {
  name: {
    description:
      "Optional SQL table name. Defaults to a name derived from the connector target (topic/table/path).",
    type: "string",
  },
  tap: {
    description: "Enable operator tailing (live preview) for this node.",
    type: "boolean | TapConfig",
  },
}

const KAFKA_FORMAT =
  "'json' | 'avro' | 'csv' | 'debezium-json' | 'debezium-avro' | 'debezium-protobuf' | 'canal-json' | 'maxwell-json'"

const PROP_DOCS: Record<string, Record<string, PropDoc>> = {
  KafkaSource: {
    topic: {
      description: "Kafka topic to read from.",
      type: "string",
      required: true,
    },
    schema: {
      description: "Column definitions for the source table.",
      type: "SchemaDefinition",
      required: true,
    },
    bootstrapServers: {
      description:
        "Kafka bootstrap servers (host:port). Falls back to pipeline-level config when omitted.",
      type: "string",
    },
    format: {
      description:
        "Wire format. CDC formats (debezium-*, canal-json, maxwell-json) yield a retract stream; others are append-only.",
      type: KAFKA_FORMAT,
      default: "'json'",
    },
    watermark: {
      description: "Watermark declaration for event-time processing.",
      type: "WatermarkDeclaration",
    },
    startupMode: {
      description: "Where to begin reading the topic.",
      type: "'latest-offset' | 'earliest-offset' | 'group-offsets' | 'timestamp'",
      default: "'earliest-offset'",
    },
    consumerGroup: { description: "Kafka consumer group id.", type: "string" },
    primaryKey: {
      description: "Columns forming the table's primary key.",
      type: "string[]",
    },
    schemaRegistryUrl: {
      description:
        "Confluent Schema Registry URL. Required for the debezium-avro / debezium-protobuf formats.",
      type: "string",
    },
  },
  KafkaSink: {
    topic: {
      description: "Kafka topic to write to.",
      type: "string",
      required: true,
    },
    format: {
      description: "Wire format written to the topic.",
      type: "'json' | 'avro' | 'csv' | 'debezium-json' | 'debezium-avro' | 'debezium-protobuf' | 'canal-json'",
      default: "'json'",
    },
    bootstrapServers: {
      description:
        "Kafka bootstrap servers (host:port). Falls back to pipeline-level config when omitted.",
      type: "string",
    },
    schemaRegistryUrl: {
      description:
        "Confluent Schema Registry URL. Required for debezium-avro / debezium-protobuf.",
      type: "string",
    },
  },
  JdbcSource: {
    url: {
      description: "JDBC connection URL.",
      type: "string",
      required: true,
    },
    table: {
      description: "Source table name in the database.",
      type: "string",
      required: true,
    },
    schema: {
      description: "Column definitions for the source table.",
      type: "SchemaDefinition",
      required: true,
    },
    lookupCache: {
      description:
        "Cache config; marks the source for use as a lookup (dimension) table.",
      type: "{ maxRows: number; ttl: string }",
    },
  },
  JdbcSink: {
    url: {
      description: "JDBC connection URL.",
      type: "string",
      required: true,
    },
    table: {
      description: "Target table name in the database.",
      type: "string",
      required: true,
    },
    upsertMode: {
      description:
        "Write upserts (requires keyFields). Enables acceptance of retract/upsert input streams.",
      type: "boolean",
      default: "false",
    },
    keyFields: {
      description:
        "Primary-key columns for upsert semantics (required when upsertMode is true).",
      type: "string[]",
    },
  },
  FileSystemSink: {
    path: {
      description: "Output path (S3, HDFS, or local filesystem).",
      type: "string",
      required: true,
    },
    format: {
      description: "File format of written data.",
      type: "'parquet' | 'orc' | 'csv' | 'json'",
    },
    partitionBy: {
      description: "Columns to partition the output by.",
      type: "string[]",
    },
    rollingPolicy: {
      description: "File-rotation policy (size and/or interval).",
      type: "{ size?: string; interval?: string }",
    },
  },
  GenericSource: {
    connector: {
      description: "Flink SQL connector identifier (escape hatch).",
      type: "string",
      required: true,
    },
    format: { description: "Wire format for the connector.", type: "string" },
    options: {
      description: "Raw connector options passed through to Flink.",
      type: "Record<string, string>",
    },
    schema: {
      description: "Column definitions for the source table.",
      type: "SchemaDefinition",
      required: true,
    },
  },
  GenericSink: {
    connector: {
      description: "Flink SQL connector identifier (escape hatch).",
      type: "string",
      required: true,
    },
    options: {
      description: "Raw connector options passed through to Flink.",
      type: "Record<string, string>",
    },
  },
  DataGenSource: {
    schema: {
      description: "Column definitions for the generated table.",
      type: "SchemaDefinition",
      required: true,
    },
    rowsPerSecond: {
      description: "Rows emitted per second (Flink 'rows-per-second').",
      type: "number",
    },
    fieldsPerSecond: {
      description: "Fields generated per second.",
      type: "number",
    },
    numberOfRows: {
      description: "Total rows to generate (unbounded if omitted).",
      type: "number",
    },
  },
  IcebergSink: {
    catalog: {
      description: "Iceberg catalog handle.",
      type: "CatalogHandle",
      required: true,
    },
    database: {
      description: "Target database (namespace).",
      type: "string",
      required: true,
    },
    table: {
      description: "Target table name.",
      type: "string",
      required: true,
    },
    primaryKey: {
      description: "Primary-key columns (enables row-level upserts).",
      type: "string[]",
    },
    formatVersion: {
      description: "Iceberg table format version.",
      type: "1 | 2",
    },
    upsertEnabled: {
      description: "Enable equality-delete upserts (MoR).",
      type: "boolean",
    },
  },
  PaimonSink: {
    catalog: {
      description: "Paimon catalog handle.",
      type: "CatalogHandle",
      required: true,
    },
    database: {
      description: "Target database.",
      type: "string",
      required: true,
    },
    table: {
      description: "Target table name.",
      type: "string",
      required: true,
    },
    primaryKey: {
      description: "Primary-key columns for the Paimon table.",
      type: "string[]",
    },
    bucket: {
      description:
        "Number of buckets — the key throughput knob; match to writer parallelism.",
      type: "number",
      default: "-1 (dynamic)",
    },
  },
  FlussSink: {
    catalog: {
      description: "Fluss catalog handle.",
      type: "CatalogHandle",
      required: true,
    },
    database: {
      description: "Target database.",
      type: "string",
      required: true,
    },
    table: {
      description: "Target table name.",
      type: "string",
      required: true,
    },
    primaryKey: {
      description:
        "Declares a Fluss PrimaryKey (upsert) table; omit for a Log (append-only) table.",
      type: "string[]",
    },
    buckets: {
      description: "Number of buckets for the Fluss table.",
      type: "number",
    },
  },
  FlussSource: {
    database: {
      description: "Source database.",
      type: "string",
      required: true,
    },
    table: {
      description: "Source table name.",
      type: "string",
      required: true,
    },
    catalogName: {
      description: "Name of the Fluss catalog to read through.",
      type: "string",
    },
    scanStartupMode: {
      description: "Where to begin scanning the Fluss table.",
      type: "'initial' | 'earliest' | 'latest' | 'timestamp'",
      default: "'initial'",
    },
    primaryKey: {
      description:
        "Primary-key columns (PrimaryKey tables produce a retract stream).",
      type: "string[]",
    },
  },
}

/**
 * The documented description/type/default for a connector prop, or `undefined`
 * when the component or prop is not in the curated table (the provider then
 * degrades gracefully or defers to the ts-plugin's TS hover).
 */
export function getPropDoc(
  component: string,
  propName: string,
): PropDoc | undefined {
  return PROP_DOCS[component]?.[propName] ?? SHARED[propName]
}
