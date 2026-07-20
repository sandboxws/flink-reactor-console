// One-line component descriptions for the hover card header.
//
// The ts-plugin component inventory maps component → kind but carries no prose;
// this curated table supplies the one-liner. Unlisted components fall back to a
// kind-derived description, so a new component still renders a sensible header.

const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  Pipeline:
    "A FlinkReactor pipeline — a DAG of sources, transforms, and sinks.",
  // Sources
  KafkaSource: "Reads from an Apache Kafka topic.",
  JdbcSource: "Reads from a relational database via JDBC.",
  GenericSource: "Generic source — any Flink SQL source connector.",
  DataGenSource: "Generates synthetic rows (datagen) for testing.",
  FlussSource: "Reads from a Fluss table.",
  // Sinks
  KafkaSink: "Writes to an Apache Kafka topic.",
  JdbcSink: "Writes to a relational database via JDBC.",
  FileSystemSink: "Writes to a filesystem path (S3, HDFS, or local).",
  GenericSink: "Generic sink — any Flink SQL sink connector.",
  IcebergSink: "Writes to an Apache Iceberg table.",
  PaimonSink: "Writes to an Apache Paimon table.",
  FlussSink: "Writes to a Fluss table.",
  // Transforms
  Filter: "Filters rows by a boolean predicate (SQL `WHERE`).",
  Map: "Projects and renames columns (SQL `SELECT`).",
  FlatMap: "Expands each row into zero or more rows.",
  Aggregate: "Groups and aggregates rows (SQL `GROUP BY`).",
  Union: "Unions multiple upstream streams.",
  Deduplicate: "Keeps the first/last row per key.",
  TopN: "Keeps the top-N rows per partition.",
  Route: "Routes rows to branches by predicate.",
  Qualify: "Filters by a window-function result (SQL `QUALIFY`).",
  // Joins / windows
  Join: "Joins two streams on a predicate.",
  IntervalJoin: "Joins two streams within an event-time interval.",
  TemporalJoin: "Enriches a stream against a versioned dimension table.",
  LookupJoin: "Enriches a stream against a lookup (dimension) table.",
  TumbleWindow: "Tumbling (fixed) event-time window.",
  HopWindow: "Hopping (sliding) event-time window.",
  SessionWindow: "Session (gap-based) event-time window.",
  // Catalogs
  IcebergCatalog: "Declares an Apache Iceberg catalog.",
  PaimonCatalog: "Declares an Apache Paimon catalog.",
  FlussCatalog: "Declares a Fluss catalog.",
}

/** One-line description for a component, falling back to a kind-derived line. */
export function getComponentDescription(
  component: string,
  kind?: string,
): string {
  return (
    COMPONENT_DESCRIPTIONS[component] ??
    (kind ? `A ${kind} component.` : "A FlinkReactor component.")
  )
}

/** Whether `component` has a curated description (a known FlinkReactor tag). */
export function isDocumentedComponent(component: string): boolean {
  return Object.hasOwn(COMPONENT_DESCRIPTIONS, component)
}
