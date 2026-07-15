import { gql } from "urql"
import type {
  InstrumentInfo,
  InstrumentType,
  DatabaseSchema,
  DatabaseTableSummary,
  DatabaseTableDetail,
  DatabaseQueryResult,
  DatabaseQueryHistoryEntry,
  RedisScanResult,
  RedisKeyInfo,
  RedisKeyValue,
  RedisServerInfo,
  RedisMemoryStats,
  SchemaSubject,
  SchemaDetail,
  CompatibilityResult,
  FlussTableSummary,
  FlussTableMetadata,
  FlussTabletServerHealth,
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

// ---------------------------------------------------------------------------
// Redis instrument
// ---------------------------------------------------------------------------

const REDIS_SCAN_QUERY = gql`
  query RedisScan(
    $instrument: String!
    $cursor: String
    $pattern: String
    $count: Int
  ) {
    redisScan(
      instrument: $instrument
      cursor: $cursor
      pattern: $pattern
      count: $count
    ) {
      keys
      cursor
      hasMore
    }
  }
`

const REDIS_KEY_INFO_QUERY = gql`
  query RedisKeyInfo($instrument: String!, $key: String!) {
    redisKeyInfo(instrument: $instrument, key: $key) {
      key
      type
      ttl
      encoding
      memoryUsage
    }
  }
`

const REDIS_KEY_VALUE_QUERY = gql`
  query RedisKeyValue($instrument: String!, $key: String!) {
    redisKeyValue(instrument: $instrument, key: $key) {
      key
      type
      stringValue
      hashValue {
        field
        value
      }
      listValue
      setValue
      zsetValue {
        member
        score
      }
      truncated
      totalSize
    }
  }
`

const REDIS_SERVER_INFO_QUERY = gql`
  query RedisServerInfo($instrument: String!) {
    redisServerInfo(instrument: $instrument) {
      version
      uptime
      connectedClients
      usedMemory
      totalKeys
      keyspaceHits
      keyspaceMisses
    }
  }
`

const REDIS_MEMORY_STATS_QUERY = gql`
  query RedisMemoryStats($instrument: String!) {
    redisMemoryStats(instrument: $instrument) {
      usedMemory
      peakMemory
      rss
      fragmentationRatio
      datasetSize
      overhead
      allocator
    }
  }
`

export async function fetchRedisScan(
  instrument: string,
  cursor: string | null,
  pattern: string,
  count: number,
): Promise<RedisScanResult> {
  const client = getGraphQLClient()
  const result = await client
    .query(REDIS_SCAN_QUERY, {
      instrument,
      cursor: cursor ?? "0",
      pattern: pattern || null,
      count,
    })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.redisScan
}

export async function fetchRedisKeyInfo(
  instrument: string,
  key: string,
): Promise<RedisKeyInfo> {
  const client = getGraphQLClient()
  const result = await client
    .query(REDIS_KEY_INFO_QUERY, { instrument, key })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.redisKeyInfo
}

export async function fetchRedisKeyValue(
  instrument: string,
  key: string,
): Promise<RedisKeyValue> {
  const client = getGraphQLClient()
  const result = await client
    .query(REDIS_KEY_VALUE_QUERY, { instrument, key })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.redisKeyValue
}

export async function fetchRedisServerInfo(
  instrument: string,
): Promise<RedisServerInfo> {
  const client = getGraphQLClient()
  const result = await client
    .query(REDIS_SERVER_INFO_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.redisServerInfo
}

export async function fetchRedisMemoryStats(
  instrument: string,
): Promise<RedisMemoryStats> {
  const client = getGraphQLClient()
  const result = await client
    .query(REDIS_MEMORY_STATS_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.redisMemoryStats
}

// ---------------------------------------------------------------------------
// Schema Registry instrument
// ---------------------------------------------------------------------------

const SCHEMA_SUBJECTS_QUERY = gql`
  query SchemaSubjects($instrument: String!) {
    schemaSubjects(instrument: $instrument) {
      name
      latestVersion
      schemaType
      schemaId
      compatibility
    }
  }
`

const SCHEMA_VERSIONS_QUERY = gql`
  query SchemaVersions($instrument: String!, $subject: String!) {
    schemaVersions(instrument: $instrument, subject: $subject)
  }
`

const SCHEMA_DETAIL_QUERY = gql`
  query SchemaDetail(
    $instrument: String!
    $subject: String!
    $version: Int!
  ) {
    schemaDetail(
      instrument: $instrument
      subject: $subject
      version: $version
    ) {
      subject
      version
      id
      schemaType
      schema
      references {
        name
        subject
        version
      }
    }
  }
`

const CHECK_COMPATIBILITY_MUTATION = gql`
  mutation CheckSchemaCompatibility(
    $instrument: String!
    $subject: String!
    $schema: String!
    $schemaType: String!
  ) {
    checkSchemaCompatibility(
      instrument: $instrument
      subject: $subject
      schema: $schema
      schemaType: $schemaType
    ) {
      isCompatible
      messages
    }
  }
`

export async function fetchSchemaSubjects(
  instrument: string,
): Promise<SchemaSubject[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(SCHEMA_SUBJECTS_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.schemaSubjects ?? []
}

export async function fetchSchemaVersions(
  instrument: string,
  subject: string,
): Promise<number[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(SCHEMA_VERSIONS_QUERY, { instrument, subject })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.schemaVersions ?? []
}

export async function fetchSchemaDetail(
  instrument: string,
  subject: string,
  version: number,
): Promise<SchemaDetail> {
  const client = getGraphQLClient()
  const result = await client
    .query(SCHEMA_DETAIL_QUERY, { instrument, subject, version })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.schemaDetail
}

export async function checkSchemaCompatibility(
  instrument: string,
  subject: string,
  schema: string,
  schemaType: string,
): Promise<CompatibilityResult> {
  const client = getGraphQLClient()
  const result = await client
    .mutation(CHECK_COMPATIBILITY_MUTATION, {
      instrument,
      subject,
      schema,
      schemaType,
    })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.checkSchemaCompatibility
}

// ---------------------------------------------------------------------------
// Fluss instrument
// ---------------------------------------------------------------------------

const FLUSS_DATABASES_QUERY = gql`
  query FlussDatabases($instrument: String!) {
    flussDatabases(instrument: $instrument)
  }
`

const FLUSS_TABLES_QUERY = gql`
  query FlussTables($instrument: String!, $database: String!) {
    flussTables(instrument: $instrument, database: $database) {
      database
      name
      tableType
      bucketCount
      bucketKey
      primaryKey
      lastUpdatedMs
    }
  }
`

const FLUSS_TABLE_QUERY = gql`
  query FlussTable(
    $instrument: String!
    $database: String!
    $table: String!
  ) {
    flussTable(instrument: $instrument, database: $database, table: $table) {
      database
      name
      tableType
      bucketCount
      bucketKey
      primaryKey
      schema {
        name
        type
        nullable
        comment
      }
      properties
      comment
      lastUpdatedMs
    }
  }
`

const FLUSS_TABLET_SERVERS_QUERY = gql`
  query FlussTabletServers($instrument: String!) {
    flussTabletServers(instrument: $instrument) {
      server
      alive
      leadership
    }
  }
`

export async function fetchFlussDatabases(
  instrument: string,
): Promise<string[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(FLUSS_DATABASES_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.flussDatabases ?? []
}

export async function fetchFlussTables(
  instrument: string,
  database: string,
): Promise<FlussTableSummary[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(FLUSS_TABLES_QUERY, { instrument, database })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.flussTables ?? []
}

export async function fetchFlussTable(
  instrument: string,
  database: string,
  table: string,
): Promise<FlussTableMetadata> {
  const client = getGraphQLClient()
  const result = await client
    .query(FLUSS_TABLE_QUERY, { instrument, database, table })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.flussTable
}

export async function fetchFlussTabletServers(
  instrument: string,
): Promise<FlussTabletServerHealth[]> {
  const client = getGraphQLClient()
  const result = await client
    .query(FLUSS_TABLET_SERVERS_QUERY, { instrument })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.flussTabletServers ?? []
}
