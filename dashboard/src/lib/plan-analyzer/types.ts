/**
 * Flink plan analyzer type definitions.
 *
 * Standalone types for normalizing and analyzing Flink execution plans.
 * These types have no inheritance from the cluster-types data layer — the plan
 * analyzer operates on raw plan JSON and produces its own domain model.
 *
 * @module plan-analyzer/types
 */

/** High-level classification of a Flink operator (source, sink, join, etc.). */
export type FlinkOperatorCategory =
  | "source"
  | "sink"
  | "transformation"
  | "aggregation"
  | "window"
  | "join"
  | "deduplication"
  | "cep"
  | "exchange"
  | "unknown"

/**
 * Specific Flink operator type, matching the operator names found in execution plan JSON.
 * Grouped by category: sources, transformations, aggregations, windows, joins,
 * deduplication/ranking, CEP, exchange, and sinks.
 */
export type FlinkOperatorType =
  // Sources
  | "TableSourceScan"
  | "Values"
  | "Source"
  | "KafkaSource"
  | "FileSource"
  | "JdbcSource"
  // Transformations
  | "Calc"
  | "Filter"
  | "Project"
  | "Union"
  | "Correlate"
  // Aggregations
  | "GroupAggregate"
  | "GlobalGroupAggregate"
  | "LocalGroupAggregate"
  | "HashAggregate"
  | "SortAggregate"
  | "Aggregate"
  // Windows
  | "WindowAggregate"
  | "WindowTableFunction"
  | "WindowJoin"
  | "WindowRank"
  // Joins
  | "Join"
  | "LookupJoin"
  | "TemporalJoin"
  | "IntervalJoin"
  // Deduplication & Ranking
  | "Deduplicate"
  | "Rank"
  | "RowNumber"
  // CEP
  | "Match"
  // Exchange
  | "Exchange"
  // Sinks
  | "Sink"
  | "KafkaSink"
  | "JdbcSink"
  | "FileSystemSink"
  | "PrintSink"
  | "UpsertMaterialize"
  // Unknown
  | "Unknown"

/**
 * Data shuffle strategy between operators.
 * Superset of `ShipStrategy` from cluster-types, extended with CUSTOM and UNKNOWN
 * for plan analysis scenarios where the strategy cannot be determined.
 */
export type ShuffleStrategy =
  | "FORWARD"
  | "HASH"
  | "REBALANCE"
  | "BROADCAST"
  | "RESCALE"
  | "GLOBAL"
  | "CUSTOM"
  | "UNKNOWN"

/** Exchange mode controlling how data is transferred between operators (pipelined vs. batch). */
export type ExchangeMode =
  | "pipelined"
  | "pipelined_bounded"
  | "batch"
  | "undefined"

/** Changelog mode for Flink SQL stream processing (insert-only, upsert, retract, or all). */
export type ChangelogMode = "INSERT_ONLY" | "UPSERT" | "RETRACT" | "ALL"

/** Input specification for join operators, describing the uniqueness guarantees of the input key. */
export type InputSpec =
  | "NoUniqueKey"
  | "HasUniqueKey"
  | "JoinKeyContainsUniqueKey"

/** How an operator's state grows over time: bounded (fixed), linear (proportional to keys), or unbounded (no limit). */
export type StateGrowthPattern = "bounded" | "linear" | "unbounded"

/** Flink state backend type used by a stateful operator. */
export type FlinkStateType =
  | "ValueState"
  | "ListState"
  | "MapState"
  | "ReducingState"
  | "AggregatingState"
  | "WindowState"
  | "KeyedBroadcastState"
  | "None"

/** Type of join operation performed by a join operator. */
export type FlinkJoinType =
  | "RegularJoin"
  | "IntervalJoin"
  | "TemporalJoin"
  | "LookupJoin"
  | "WindowJoin"

/** Type of window operation: tumbling, hopping (sliding), session, or cumulative. */
export type FlinkWindowType = "TUMBLE" | "HOP" | "SESSION" | "CUMULATE"

// Flink-specific anti-pattern types
export type FlinkAntiPatternType =
  | "unbounded-state-join"
  | "unbounded-state-aggregate"
  | "missing-watermark"
  | "watermark-not-pushed-down"
  | "data-skew-low-cardinality"
  | "data-skew-null-key"
  | "sync-lookup-join"
  | "lookup-no-cache"
  | "changelog-incompatible"
  | "missing-primary-key"
  | "large-window"
  | "sliding-window-pane-explosion"
  | "session-no-timeout"
  | "count-distinct-high-cardinality"
  | "broadcast-large-table"
  | "hash-before-skew"

// Flink operator node — standalone, no PlanNode inheritance
export interface FlinkOperatorNode {
  id: string
  nodeType: string
  operation: string
  operatorType: FlinkOperatorType
  category: FlinkOperatorCategory
  parallelism: number
  description?: string

  // Shuffle information
  inputs: FlinkOperatorInput[]

  // State information
  stateInfo?: FlinkStateInfo

  // Changelog mode
  changelogMode?: ChangelogMode

  // Join-specific
  joinInfo?: FlinkJoinInfo

  // Window-specific
  windowInfo?: FlinkWindowInfo

  // Lookup join specific
  lookupInfo?: FlinkLookupInfo

  // Operator-specific properties
  selectExpressions?: string[]
  whereCondition?: string
  groupByKeys?: string[]
  aggregateFunctions?: string[]

  // Tree structure
  children: FlinkOperatorNode[]
  parentId?: string

  // Source relation/topic
  relation?: string

  // Runtime metrics (populated from job graph)
  actualRows?: number

  // Raw data for debugging
  rawData: Record<string, unknown>
}

export interface FlinkOperatorInput {
  operatorId: string
  shipStrategy: ShuffleStrategy
  exchangeMode: ExchangeMode
  side?: "first" | "second"
}

export interface FlinkStateInfo {
  stateType: FlinkStateType
  growthPattern: StateGrowthPattern
  estimatedSizeBytes?: number
  ttlConfigured: boolean
  ttlDuration?: number // milliseconds
}

export interface FlinkJoinInfo {
  joinType: FlinkJoinType
  joinCondition?: string
  leftInputSpec: InputSpec
  rightInputSpec: InputSpec
  hasIntervalCondition: boolean
  intervalBounds?: {
    lower: number // milliseconds
    upper: number // milliseconds
  }
}

export interface FlinkWindowInfo {
  windowType: FlinkWindowType
  windowSize: number // milliseconds
  windowSlide?: number // for HOP windows
  sessionGap?: number // for SESSION windows
  allowedLateness?: number
}

export interface FlinkLookupInfo {
  tableName: string
  async?: boolean
  asyncCapacity?: number
  asyncTimeout?: number
  cacheEnabled?: boolean
  cacheSize?: number
  cacheTTL?: number
  retryEnabled?: boolean
  retryAttempts?: number
}

// Normalized Flink plan
export interface NormalizedFlinkPlan {
  root: FlinkOperatorNode
  totalNodes: number
  maxDepth: number
  rawPlan: unknown
  format: string
  jobType: "STREAMING" | "BATCH"
  flinkVersion?: string
}

// State growth forecast
export interface StateGrowthForecast {
  operatorId: string
  operatorName: string
  stateType: FlinkStateType
  growthPattern: StateGrowthPattern
  estimatedSize1h: number
  estimatedSize24h: number
  estimatedSize7d: number
  ttlConfigured: boolean
  ttlDuration?: number
  warning?: string
}

// Watermark health
export interface WatermarkHealth {
  sourceId: string
  sourceName: string
  hasWatermark: boolean
  watermarkExpression?: string
  maxOutOfOrderness?: number
  idleTimeout?: number
  issues: string[]
}

// Flink-specific anti-pattern
export interface FlinkAntiPattern {
  id: string
  nodeId: string
  severity: "info" | "warning" | "critical"
  type: FlinkAntiPatternType
  title: string
  description: string
  suggestion: string
  flinkConfig?: string
  sqlRewrite?: string
  ddlFix?: string
}

// Flink-specific recommendation
export interface FlinkRecommendation {
  id: string
  severity: "critical" | "warning" | "optimization"
  category:
    | "state"
    | "watermark"
    | "skew"
    | "join"
    | "window"
    | "parallelism"
    | "checkpoint"
  title: string
  description: string
  affectedOperators: string[]
  evidence: string
  solution: string
  sqlConfig?: string
  ddlFix?: string
}

// Flink-specific bottleneck
export interface FlinkBottleneck {
  nodeId: string
  nodeName: string
  percentage: number
  time: number
  reason: string
  bottleneckType: "shuffle" | "state" | "network" | "cpu"
  shuffleStrategy?: ShuffleStrategy
}

// Analyzed Flink plan
export interface AnalyzedFlinkPlan extends NormalizedFlinkPlan {
  id: string
  name: string
  createdAt: number

  // Flink-specific analysis
  stateForecasts: StateGrowthForecast[]
  watermarkHealth: WatermarkHealth[]
  antiPatterns: FlinkAntiPattern[]
  bottlenecks: FlinkBottleneck[]
  recommendations: FlinkRecommendation[]
  workloadType: "OLTP" | "OLAP" | "Mixed"
  criticalPath: string[]

  // Totals
  totalEstimatedState24h: number
  totalEstimatedState7d: number
}

// Plan format detection result
export type FlinkPlanFormat = "json" | "text" | "job-graph"
