/** Plan analyzer types — Flink query plan analysis domain types. */

/** High-level category of a Flink operator. */
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

/** Specific Flink operator type as identified from the execution plan. */
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

/** Data shuffle strategy between operators in the execution plan. */
export type ShuffleStrategy =
  | "FORWARD"
  | "HASH"
  | "REBALANCE"
  | "BROADCAST"
  | "RESCALE"
  | "GLOBAL"
  | "CUSTOM"
  | "UNKNOWN"

/** Data exchange mode between operators. */
export type ExchangeMode =
  | "pipelined"
  | "pipelined_bounded"
  | "batch"
  | "undefined"

/** Changelog mode for Flink SQL operators (determines insert/update/delete semantics). */
export type ChangelogMode = "INSERT_ONLY" | "UPSERT" | "RETRACT" | "ALL"

/** Input key specification for join operators — affects state management. */
export type InputSpec =
  | "NoUniqueKey"
  | "HasUniqueKey"
  | "JoinKeyContainsUniqueKey"

/** How operator state grows over time. */
export type StateGrowthPattern = "bounded" | "linear" | "unbounded"

/** Flink state backend type used by an operator. */
export type FlinkStateType =
  | "ValueState"
  | "ListState"
  | "MapState"
  | "ReducingState"
  | "AggregatingState"
  | "WindowState"
  | "KeyedBroadcastState"
  | "None"

/** Flink join strategy type. */
export type FlinkJoinType =
  | "RegularJoin"
  | "IntervalJoin"
  | "TemporalJoin"
  | "LookupJoin"
  | "WindowJoin"

/** Flink windowing strategy type. */
export type FlinkWindowType = "TUMBLE" | "HOP" | "SESSION" | "CUMULATE"

/** Categories of Flink-specific anti-patterns detected during plan analysis. */
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

/** A single operator node in the normalized Flink execution plan tree. */
export interface FlinkOperatorNode {
  id: string
  /** Raw node type string from the plan. */
  nodeType: string
  /** Human-readable operation description (e.g. "Filter(condition=...)"). */
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
  /** Projected columns or computed expressions. */
  selectExpressions?: string[]
  /** Filter predicate expression. */
  whereCondition?: string
  /** GROUP BY key columns. */
  groupByKeys?: string[]
  /** Aggregate function names (e.g. "SUM", "COUNT"). */
  aggregateFunctions?: string[]
  children: FlinkOperatorNode[]
  parentId?: string
  /** Relationship label to parent (e.g. "left", "right" for joins). */
  relation?: string
  /** Actual row count if available from runtime metrics. */
  actualRows?: number
  /** Original unprocessed data from the plan parser. */
  rawData: Record<string, unknown>
}

/** An input connection to an operator, describing shuffle and exchange behavior. */
export interface FlinkOperatorInput {
  operatorId: string
  shipStrategy: ShuffleStrategy
  exchangeMode: ExchangeMode
  /** For joins: which side this input represents. */
  side?: "first" | "second"
}

/** State backend information for an operator. */
export interface FlinkStateInfo {
  stateType: FlinkStateType
  growthPattern: StateGrowthPattern
  /** Estimated state size in bytes based on heuristic analysis. */
  estimatedSizeBytes?: number
  /** Whether a TTL (time-to-live) is configured for state cleanup. */
  ttlConfigured: boolean
  /** TTL duration in milliseconds, if configured. */
  ttlDuration?: number
}

/** Join operator metadata for analysis. */
export interface FlinkJoinInfo {
  joinType: FlinkJoinType
  joinCondition?: string
  leftInputSpec: InputSpec
  rightInputSpec: InputSpec
  /** Whether the join has an interval (time-bounded) condition. */
  hasIntervalCondition: boolean
  /** Time interval bounds in milliseconds for interval joins. */
  intervalBounds?: {
    lower: number
    upper: number
  }
}

/** Window operator metadata for analysis. */
export interface FlinkWindowInfo {
  windowType: FlinkWindowType
  /** Window size in milliseconds. */
  windowSize: number
  /** Slide interval in milliseconds (for HOP windows). */
  windowSlide?: number
  /** Session gap in milliseconds (for SESSION windows). */
  sessionGap?: number
  /** Allowed lateness in milliseconds. */
  allowedLateness?: number
}

/** Lookup join operator metadata for analysis. */
export interface FlinkLookupInfo {
  tableName: string
  /** Whether the lookup is asynchronous. */
  async?: boolean
  /** Max concurrent async lookup requests. */
  asyncCapacity?: number
  /** Async lookup timeout in milliseconds. */
  asyncTimeout?: number
  /** Whether lookup caching is enabled. */
  cacheEnabled?: boolean
  /** Maximum cache size (number of entries). */
  cacheSize?: number
  /** Cache TTL in milliseconds. */
  cacheTTL?: number
  retryEnabled?: boolean
  retryAttempts?: number
}

/** Normalized Flink execution plan — the parsed and structured representation. */
export interface NormalizedFlinkPlan {
  root: FlinkOperatorNode
  totalNodes: number
  maxDepth: number
  rawPlan: unknown
  /** Parser format that produced this plan (e.g. "json", "text"). */
  format: string
  jobType: "STREAMING" | "BATCH"
  flinkVersion?: string
}

/** Projected state growth for an operator over time. */
export interface StateGrowthForecast {
  operatorId: string
  operatorName: string
  stateType: FlinkStateType
  growthPattern: StateGrowthPattern
  /** Estimated state size after 1 hour in bytes. */
  estimatedSize1h: number
  /** Estimated state size after 24 hours in bytes. */
  estimatedSize24h: number
  /** Estimated state size after 7 days in bytes. */
  estimatedSize7d: number
  ttlConfigured: boolean
  ttlDuration?: number
  /** Warning message if state growth is concerning. */
  warning?: string
}

/** Watermark health assessment for a source operator. */
export interface WatermarkHealth {
  sourceId: string
  sourceName: string
  /** Whether a watermark strategy is defined. */
  hasWatermark: boolean
  watermarkExpression?: string
  /** Max out-of-orderness in milliseconds. */
  maxOutOfOrderness?: number
  /** Idle source timeout in milliseconds. */
  idleTimeout?: number
  /** List of issues found (e.g. "No watermark defined"). */
  issues: string[]
}

/** A detected anti-pattern in the Flink execution plan. */
export interface FlinkAntiPattern {
  id: string
  /** Operator node ID where the anti-pattern was found. */
  nodeId: string
  severity: "info" | "warning" | "critical"
  type: FlinkAntiPatternType
  title: string
  description: string
  /** Suggested fix or mitigation. */
  suggestion: string
  /** Flink configuration key to set, if applicable. */
  flinkConfig?: string
  /** Rewritten SQL query, if applicable. */
  sqlRewrite?: string
  /** DDL fix (e.g. adding PRIMARY KEY), if applicable. */
  ddlFix?: string
}

/** An optimization recommendation generated from plan analysis. */
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
  /** Operator IDs affected by this recommendation. */
  affectedOperators: string[]
  /** Evidence from the plan that supports this recommendation. */
  evidence: string
  /** Suggested solution or action. */
  solution: string
  /** Flink SQL SET command, if applicable. */
  sqlConfig?: string
  /** DDL fix, if applicable. */
  ddlFix?: string
}

/** A detected performance bottleneck in the execution plan. */
export interface FlinkBottleneck {
  nodeId: string
  nodeName: string
  /** Percentage of total execution time attributed to this bottleneck (0–100). */
  percentage: number
  /** Estimated time impact in milliseconds. */
  time: number
  reason: string
  bottleneckType: "shuffle" | "state" | "network" | "cpu"
  shuffleStrategy?: ShuffleStrategy
}

/** Fully analyzed Flink plan with all analysis results attached. */
export interface AnalyzedFlinkPlan extends NormalizedFlinkPlan {
  id: string
  name: string
  /** Creation timestamp as epoch milliseconds. */
  createdAt: number
  stateForecasts: StateGrowthForecast[]
  watermarkHealth: WatermarkHealth[]
  antiPatterns: FlinkAntiPattern[]
  bottlenecks: FlinkBottleneck[]
  recommendations: FlinkRecommendation[]
  workloadType: "OLTP" | "OLAP" | "Mixed"
  /** Ordered list of operator IDs on the critical path. */
  criticalPath: string[]
  /** Total estimated state size after 24 hours in bytes. */
  totalEstimatedState24h: number
  /** Total estimated state size after 7 days in bytes. */
  totalEstimatedState7d: number
}

/** Detected format of a Flink execution plan input. */
export type FlinkPlanFormat = "json" | "text" | "job-graph"
