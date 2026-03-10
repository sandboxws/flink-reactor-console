import { gql } from "urql"
import type {
  InstrumentInfo,
  InstrumentType,
  DatabaseSchema,
  DatabaseTableSummary,
  DatabaseTableDetail,
  DatabaseQueryResult,
  DatabaseQueryHistoryEntry,
} from "./types"
import { getGraphQLClient } from "./graphql-client"

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

const INSTRUMENTS_QUERY = gql`
  query Instruments {
    instruments {
      name
      displayName
      type
      version
      healthy
      lastHealthCheck
      capabilities
    }
  }
`

type RawInstrument = {
  name: string
  displayName: string
  type: string
  version: string
  healthy: boolean
  lastHealthCheck: string | null
  capabilities: string[]
}

export async function fetchInstruments(): Promise<InstrumentInfo[]> {
  const client = getGraphQLClient()
  const result = await client.query(INSTRUMENTS_QUERY, {}).toPromise()

  if (result.error) {
    throw new Error(result.error.message)
  }

  return (result.data?.instruments ?? []).map(
    (raw: RawInstrument): InstrumentInfo => ({
      name: raw.name,
      displayName: raw.displayName,
      type: raw.type as InstrumentType,
      version: raw.version,
      healthy: raw.healthy,
      lastHealthCheck: raw.lastHealthCheck
        ? new Date(raw.lastHealthCheck)
        : null,
      capabilities: raw.capabilities,
    }),
  )
}

// ---------------------------------------------------------------------------
// Database instrument
// ---------------------------------------------------------------------------

const DATABASE_SCHEMAS_QUERY = gql`
  query DatabaseSchemas($instrument: String!) {
    databaseSchemas(instrument: $instrument) {
      name
      tableCount
    }
  }
`

const DATABASE_TABLES_QUERY = gql`
  query DatabaseTables($instrument: String!, $schema: String!) {
    databaseTables(instrument: $instrument, schema: $schema) {
      name
      schema
      type
      rowCountEstimate
    }
  }
`

const DATABASE_TABLE_QUERY = gql`
  query DatabaseTable($instrument: String!, $schema: String!, $table: String!) {
    databaseTable(instrument: $instrument, schema: $schema, table: $table) {
      name
      schema
      columns {
        name
        dataType
        nullable
        defaultValue
        isPrimaryKey
        comment
      }
      indexes {
        name
        columns
        unique
        type
      }
      constraints {
        name
        type
        columns
        refTable
        refColumns
      }
    }
  }
`

const DATABASE_QUERY_HISTORY_QUERY = gql`
  query DatabaseQueryHistory($instrument: String!) {
    databaseQueryHistory(instrument: $instrument) {
      sql
      executedAt
      executionTimeMs
      rowCount
      error
    }
  }
`

const EXECUTE_DATABASE_QUERY_MUTATION = gql`
  mutation ExecuteDatabaseQuery($instrument: String!, $sql: String!) {
    executeDatabaseQuery(instrument: $instrument, sql: $sql) {
      columns {
        name
        dataType
      }
      rows
      rowCount
      executionTimeMs
      truncated
    }
  }
`

export async function fetchDatabaseSchemas(
  instrument: string,
): Promise<DatabaseSchema[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(DATABASE_SCHEMAS_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.databaseSchemas ?? []
}

export async function fetchDatabaseTables(
  instrument: string,
  schema: string,
): Promise<DatabaseTableSummary[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(DATABASE_TABLES_QUERY, { instrument, schema })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.databaseTables ?? []
}

export async function fetchDatabaseTable(
  instrument: string,
  schema: string,
  table: string,
): Promise<DatabaseTableDetail> {
  const client = getGraphQLClient()
  const result = await client
    .query(DATABASE_TABLE_QUERY, { instrument, schema, table })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.databaseTable
}

export async function fetchDatabaseQueryHistory(
  instrument: string,
): Promise<DatabaseQueryHistoryEntry[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(DATABASE_QUERY_HISTORY_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.databaseQueryHistory ?? []
}

export async function executeDatabaseQuery(
  instrument: string,
  sql: string,
): Promise<DatabaseQueryResult> {
  const client = getGraphQLClient()
  const result = await client
    .mutation(EXECUTE_DATABASE_QUERY_MUTATION, { instrument, sql })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.executeDatabaseQuery
}
