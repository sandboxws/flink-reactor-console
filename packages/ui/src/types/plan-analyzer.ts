// ---------------------------------------------------------------------------
// Plan analyzer types — Flink query plan analysis domain types
// ---------------------------------------------------------------------------

// Flink operator categories
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

// Flink operator types
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

// Shuffle strategies between operators
export type ShuffleStrategy =
  | "FORWARD"
  | "HASH"
  | "REBALANCE"
  | "BROADCAST"
  | "RESCALE"
  | "GLOBAL"
  | "CUSTOM"
  | "UNKNOWN"

// Exchange modes
export type ExchangeMode =
  | "pipelined"
  | "pipelined_bounded"
  | "batch"
  | "undefined"

// Changelog modes for Flink SQL
export type ChangelogMode = "INSERT_ONLY" | "UPSERT" | "RETRACT" | "ALL"

// Input specification for joins
export type InputSpec =
  | "NoUniqueKey"
  | "HasUniqueKey"
  | "JoinKeyContainsUniqueKey"

// State growth patterns
export type StateGrowthPattern = "bounded" | "linear" | "unbounded"

// State types
export type FlinkStateType =
  | "ValueState"
  | "ListState"
  | "MapState"
  | "ReducingState"
  | "AggregatingState"
  | "WindowState"
  | "KeyedBroadcastState"
  | "None"

// Join types
export type FlinkJoinType =
  | "RegularJoin"
  | "IntervalJoin"
  | "TemporalJoin"
  | "LookupJoin"
  | "WindowJoin"

// Window types
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

// Flink operator node
export interface FlinkOperatorNode {
  id: string
  nodeType: string
  operation: string
  operatorType: FlinkOperatorType
  category: FlinkOperatorCategory
  parallelism: number
  description?: string
  inputs: FlinkOperatorInput[]
  stateInfo?: FlinkStateInfo
  changelogMode?: ChangelogMode
  joinInfo?: FlinkJoinInfo
  windowInfo?: FlinkWindowInfo
  lookupInfo?: FlinkLookupInfo
  selectExpressions?: string[]
  whereCondition?: string
  groupByKeys?: string[]
  aggregateFunctions?: string[]
  children: FlinkOperatorNode[]
  parentId?: string
  relation?: string
  actualRows?: number
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
  ttlDuration?: number
}

export interface FlinkJoinInfo {
  joinType: FlinkJoinType
  joinCondition?: string
  leftInputSpec: InputSpec
  rightInputSpec: InputSpec
  hasIntervalCondition: boolean
  intervalBounds?: {
    lower: number
    upper: number
  }
}

export interface FlinkWindowInfo {
  windowType: FlinkWindowType
  windowSize: number
  windowSlide?: number
  sessionGap?: number
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
  stateForecasts: StateGrowthForecast[]
  watermarkHealth: WatermarkHealth[]
  antiPatterns: FlinkAntiPattern[]
  bottlenecks: FlinkBottleneck[]
  recommendations: FlinkRecommendation[]
  workloadType: "OLTP" | "OLAP" | "Mixed"
  criticalPath: string[]
  totalEstimatedState24h: number
  totalEstimatedState7d: number
}

// Plan format detection result
export type FlinkPlanFormat = "json" | "text" | "job-graph"
