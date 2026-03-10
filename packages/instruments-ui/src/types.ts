// ---------------------------------------------------------------------------
// Instrument domain types — shared across instrument list, detail, sidebar
// ---------------------------------------------------------------------------

export type InstrumentType =
  | "kafka"
  | "database"
  | "kubernetes"
  | "s3"
  | "prometheus"
  | "redis"
  | "schemaregistry"

export type InstrumentCapability = string

export type InstrumentInfo = {
  name: string
  displayName: string
  type: InstrumentType
  version: string
  healthy: boolean
  lastHealthCheck: Date | null
  capabilities: InstrumentCapability[]
}

// ---------------------------------------------------------------------------
// Database instrument types
// ---------------------------------------------------------------------------

export type DatabaseSchema = {
  name: string
  tableCount: number
}

export type DatabaseTableSummary = {
  name: string
  schema: string
  type: string
  rowCountEstimate: number
}

export type DatabaseTableDetail = {
  name: string
  schema: string
  columns: DatabaseColumn[]
  indexes: DatabaseIndex[]
  constraints: DatabaseConstraint[]
}

export type DatabaseColumn = {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string
  isPrimaryKey: boolean
  comment: string
}

export type DatabaseIndex = {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

export type DatabaseConstraint = {
  name: string
  type: string
  columns: string[]
  refTable: string
  refColumns: string[]
}

export type DatabaseQueryResult = {
  columns: { name: string; dataType: string }[]
  rows: Record<string, unknown>[][]
  rowCount: number
  executionTimeMs: number
  truncated: boolean
}

export type DatabaseQueryHistoryEntry = {
  sql: string
  executedAt: string
  executionTimeMs: number
  rowCount: number
  error: string | null
}
