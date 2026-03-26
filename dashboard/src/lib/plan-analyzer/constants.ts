/**
 * Plan analyzer constants — operator classification, state metadata,
 * shuffle risk levels, regex patterns, and analysis thresholds.
 *
 * These constants drive the heuristic analysis across all analyzer modules.
 * Operator patterns use regex matching against plan text for classification.
 *
 * @module plan-analyzer/constants
 */

import type {
  FlinkOperatorCategory,
  FlinkOperatorType,
  FlinkStateType,
  ShuffleStrategy,
  StateGrowthPattern,
} from "./types"

/** Maps each Flink operator type to its high-level category (source, sink, join, etc.). */
export const OPERATOR_CATEGORIES: Record<
  FlinkOperatorType,
  FlinkOperatorCategory
> = {
  // Sources
  TableSourceScan: "source",
  Values: "source",
  Source: "source",
  KafkaSource: "source",
  FileSource: "source",
  JdbcSource: "source",

  // Transformations
  Calc: "transformation",
  Filter: "transformation",
  Project: "transformation",
  Union: "transformation",
  Correlate: "transformation",

  // Aggregations
  GroupAggregate: "aggregation",
  GlobalGroupAggregate: "aggregation",
  LocalGroupAggregate: "aggregation",
  HashAggregate: "aggregation",
  SortAggregate: "aggregation",
  Aggregate: "aggregation",

  // Windows
  WindowAggregate: "window",
  WindowTableFunction: "window",
  WindowJoin: "window",
  WindowRank: "window",

  // Joins
  Join: "join",
  LookupJoin: "join",
  TemporalJoin: "join",
  IntervalJoin: "join",

  // Deduplication & Ranking
  Deduplicate: "deduplication",
  Rank: "deduplication",
  RowNumber: "deduplication",

  // CEP
  Match: "cep",

  // Exchange
  Exchange: "exchange",

  // Sinks
  Sink: "sink",
  KafkaSink: "sink",
  JdbcSink: "sink",
  FileSystemSink: "sink",
  PrintSink: "sink",
  UpsertMaterialize: "sink",

  // Unknown
  Unknown: "unknown",
}

/** Set of operator types that maintain Flink state (joins, aggregations, deduplication, CEP). */
export const STATEFUL_OPERATORS: Set<FlinkOperatorType> = new Set([
  "Join",
  "IntervalJoin",
  "TemporalJoin",
  "GroupAggregate",
  "GlobalGroupAggregate",
  "HashAggregate",
  "SortAggregate",
  "Aggregate",
  "WindowAggregate",
  "Deduplicate",
  "Rank",
  "RowNumber",
  "Match",
])

/** Default Flink state type for each stateful operator (ValueState, MapState, ListState, etc.). */
export const OPERATOR_STATE_TYPES: Partial<
  Record<FlinkOperatorType, FlinkStateType>
> = {
  Join: "MapState",
  IntervalJoin: "MapState",
  TemporalJoin: "MapState",
  GroupAggregate: "ValueState",
  GlobalGroupAggregate: "ValueState",
  LocalGroupAggregate: "ValueState",
  HashAggregate: "MapState",
  SortAggregate: "ListState",
  WindowAggregate: "WindowState",
  Deduplicate: "ValueState",
  Rank: "MapState",
  RowNumber: "MapState",
  Match: "ListState",
}

/** State growth pattern for each stateful operator (bounded, linear, unbounded). */
export const OPERATOR_STATE_GROWTH: Partial<
  Record<FlinkOperatorType, StateGrowthPattern>
> = {
  Join: "unbounded",
  IntervalJoin: "bounded",
  TemporalJoin: "linear",
  GroupAggregate: "linear",
  GlobalGroupAggregate: "linear",
  HashAggregate: "linear",
  SortAggregate: "linear",
  WindowAggregate: "bounded",
  Deduplicate: "linear",
  Rank: "linear",
  RowNumber: "linear",
  Match: "unbounded",
}

/** Data skew risk level for each shuffle strategy (HASH and GLOBAL are high risk). */
export const SHUFFLE_RISK_LEVELS: Record<
  ShuffleStrategy,
  "none" | "low" | "medium" | "high"
> = {
  FORWARD: "none",
  REBALANCE: "none",
  RESCALE: "low",
  HASH: "high",
  BROADCAST: "medium",
  GLOBAL: "high",
  CUSTOM: "medium",
  UNKNOWN: "low",
}

/** Operator category → CSS color token for DAG visualization. */
export const CATEGORY_COLORS: Record<FlinkOperatorCategory, string> = {
  source: "fr-coral",
  sink: "fr-amber",
  transformation: "fr-blue",
  aggregation: "fr-amber",
  window: "fr-purple",
  join: "fr-purple",
  deduplication: "fr-cyan",
  cep: "fr-orange",
  exchange: "zinc-400",
  unknown: "zinc-500",
}

/** Regex patterns for classifying operator type from plan text descriptions. */
export const OPERATOR_PATTERNS: Array<{
  pattern: RegExp
  type: FlinkOperatorType
}> = [
  // Sources
  { pattern: /^TableSourceScan/i, type: "TableSourceScan" },
  { pattern: /^Values/i, type: "Values" },
  { pattern: /^Source:\s*Kafka/i, type: "KafkaSource" },
  { pattern: /^Source:\s*File/i, type: "FileSource" },
  { pattern: /^Source:\s*Jdbc/i, type: "JdbcSource" },
  { pattern: /^Source:/i, type: "Source" },

  // Joins (order matters - more specific first)
  { pattern: /^LookupJoin/i, type: "LookupJoin" },
  { pattern: /^TemporalJoin/i, type: "TemporalJoin" },
  { pattern: /^IntervalJoin/i, type: "IntervalJoin" },
  { pattern: /^WindowJoin/i, type: "WindowJoin" },
  { pattern: /^Join/i, type: "Join" },

  // Aggregations (order matters)
  { pattern: /^GlobalGroupAggregate/i, type: "GlobalGroupAggregate" },
  { pattern: /^LocalGroupAggregate/i, type: "LocalGroupAggregate" },
  { pattern: /^GroupAggregate/i, type: "GroupAggregate" },
  { pattern: /^HashAggregate/i, type: "HashAggregate" },
  { pattern: /^SortAggregate/i, type: "SortAggregate" },
  { pattern: /^Aggregate/i, type: "Aggregate" },

  // Windows
  { pattern: /^WindowAggregate/i, type: "WindowAggregate" },
  { pattern: /^WindowTableFunction/i, type: "WindowTableFunction" },
  { pattern: /^WindowRank/i, type: "WindowRank" },

  // Deduplication & Ranking
  { pattern: /^Deduplicate/i, type: "Deduplicate" },
  { pattern: /^Rank/i, type: "Rank" },
  { pattern: /^RowNumber/i, type: "RowNumber" },

  // CEP
  { pattern: /^Match/i, type: "Match" },

  // Transformations
  { pattern: /^Calc/i, type: "Calc" },
  { pattern: /^Filter/i, type: "Filter" },
  { pattern: /^Project/i, type: "Project" },
  { pattern: /^Union/i, type: "Union" },
  { pattern: /^Correlate/i, type: "Correlate" },
  { pattern: /^Exchange/i, type: "Exchange" },

  // Sinks
  { pattern: /^Sink:\s*Kafka/i, type: "KafkaSink" },
  { pattern: /^Sink:\s*Jdbc/i, type: "JdbcSink" },
  { pattern: /^Sink:\s*FileSystem/i, type: "FileSystemSink" },
  { pattern: /^Sink:\s*Print/i, type: "PrintSink" },
  { pattern: /^UpsertMaterialize/i, type: "UpsertMaterialize" },
  { pattern: /^Sink:/i, type: "Sink" },
]

/** Numeric thresholds for state size warnings, window size limits, skew detection, and state estimation. */
export const ANALYSIS_THRESHOLDS = {
  // State size warnings
  STATE_SIZE_WARNING_MB: 1024, // 1GB
  STATE_SIZE_CRITICAL_MB: 10240, // 10GB

  // Window size warnings
  WINDOW_SIZE_WARNING_HOURS: 24,
  WINDOW_SIZE_CRITICAL_HOURS: 168, // 1 week

  // Sliding window pane explosion
  SLIDING_WINDOW_PANE_WARNING: 60,
  SLIDING_WINDOW_PANE_CRITICAL: 1000,

  // Key cardinality for skew detection
  LOW_CARDINALITY_THRESHOLD: 1000,
  VERY_LOW_CARDINALITY_THRESHOLD: 100,

  // Parallelism vs key cardinality ratio
  PARALLELISM_KEY_RATIO_WARNING: 0.5,

  // Lookup join without async
  LOOKUP_JOIN_THROUGHPUT_WARNING: 1000, // records/sec

  // State growth estimation (bytes per record)
  ESTIMATED_BYTES_PER_KEY: 256,
  ESTIMATED_BYTES_PER_RECORD: 512,
  ESTIMATED_BYTES_PER_WINDOW_ENTRY: 128,
}

/** Regex patterns matching field names likely to have low cardinality (country, status, boolean flags, etc.). */
export const LOW_CARDINALITY_PATTERNS = [
  /^country/i,
  /^status/i,
  /^state/i,
  /^category/i,
  /^type/i,
  /^gender/i,
  /^region/i,
  /^tier/i,
  /^level/i,
  /^priority/i,
  /^is_\w+/i, // boolean fields
  /^has_\w+/i, // boolean fields
]

/** Human-readable labels for each shuffle strategy (used in DAG edge tooltips). */
export const SHUFFLE_STRATEGY_LABELS: Record<ShuffleStrategy, string> = {
  FORWARD: "Forward (1:1)",
  HASH: "Hash Partition",
  REBALANCE: "Round-Robin",
  BROADCAST: "Broadcast",
  RESCALE: "Local Rescale",
  GLOBAL: "Global (Single)",
  CUSTOM: "Custom",
  UNKNOWN: "Unknown",
}
