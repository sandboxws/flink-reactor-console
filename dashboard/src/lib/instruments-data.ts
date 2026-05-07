/**
 * Instruments data layer — typed wrappers over the GraphQL queries used
 * by the Hub instruments tree (P4). Keeps the queries co-located with
 * their consumers so we don't bloat `graphql-api-client.ts` further.
 *
 * All queries hit the existing Go GraphQL backend; no new resolvers
 * required — the schemas (`instruments.graphqls`, `fluss.graphqls`,
 * `schemaregistry.graphqls`, etc.) shipped with earlier phases.
 */

import { gql } from "urql"
import { graphqlClient } from "./graphql-client"

async function query<T>(
  q: any,
  variables?: Record<string, unknown>,
  requestPolicy?: import("urql").RequestPolicy,
): Promise<T> {
  const result = await graphqlClient
    .query(q, variables ?? {}, requestPolicy ? { requestPolicy } : undefined)
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

async function mutate<T>(
  m: any,
  variables?: Record<string, unknown>,
): Promise<T> {
  const result = await graphqlClient.mutation(m, variables ?? {}).toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

// ── Instruments registry ────────────────────────────────────────────

export interface InstrumentInfo {
  name: string
  displayName: string
  type: string
  version: string
  healthy: boolean
  lastHealthCheck: string | null
  capabilities: string[]
}

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

export async function fetchInstruments(): Promise<InstrumentInfo[]> {
  const data = await query<{ instruments: InstrumentInfo[] }>(
    INSTRUMENTS_QUERY,
    {},
    "network-only",
  )
  return data.instruments ?? []
}

// ── Schema registry ─────────────────────────────────────────────────

export interface SchemaSubject {
  name: string
  latestVersion: number
  schemaType: string
  schemaId: number
  compatibility: string
}

export interface SchemaDetail {
  subject: string
  version: number
  id: number
  schemaType: string
  schema: string
  references: { name: string; subject: string; version: number }[]
}

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

const SCHEMA_COMPAT_MUTATION = gql`
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
  const data = await query<{ schemaSubjects: SchemaSubject[] }>(
    SCHEMA_SUBJECTS_QUERY,
    { instrument },
  )
  return data.schemaSubjects ?? []
}

export async function fetchSchemaVersions(
  instrument: string,
  subject: string,
): Promise<number[]> {
  const data = await query<{ schemaVersions: number[] }>(
    SCHEMA_VERSIONS_QUERY,
    { instrument, subject },
  )
  return data.schemaVersions ?? []
}

export async function fetchSchemaDetail(
  instrument: string,
  subject: string,
  version: number,
): Promise<SchemaDetail> {
  const data = await query<{ schemaDetail: SchemaDetail }>(
    SCHEMA_DETAIL_QUERY,
    { instrument, subject, version },
  )
  return data.schemaDetail
}

export async function checkSchemaCompatibility(
  instrument: string,
  subject: string,
  schema: string,
  schemaType: string,
): Promise<{ isCompatible: boolean; messages: string[] }> {
  const data = await mutate<{
    checkSchemaCompatibility: { isCompatible: boolean; messages: string[] }
  }>(SCHEMA_COMPAT_MUTATION, { instrument, subject, schema, schemaType })
  return data.checkSchemaCompatibility
}

// ── Fluss ───────────────────────────────────────────────────────────

export interface FlussTableSummary {
  database: string
  name: string
  tableType: string
  bucketCount: number
  bucketKey: string[]
  primaryKey: string[]
  lastUpdatedMs: number
}

export interface FlussTabletServerHealth {
  server: string
  alive: boolean
  leadership: number
}

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
  const data = await query<{ flussDatabases: string[] }>(
    FLUSS_DATABASES_QUERY,
    { instrument },
  )
  return data.flussDatabases ?? []
}

export async function fetchFlussTables(
  instrument: string,
  database: string,
): Promise<FlussTableSummary[]> {
  const data = await query<{ flussTables: FlussTableSummary[] }>(
    FLUSS_TABLES_QUERY,
    { instrument, database },
  )
  return data.flussTables ?? []
}

export async function fetchFlussTabletServers(
  instrument: string,
): Promise<FlussTabletServerHealth[]> {
  const data = await query<{ flussTabletServers: FlussTabletServerHealth[] }>(
    FLUSS_TABLET_SERVERS_QUERY,
    { instrument },
  )
  return data.flussTabletServers ?? []
}

// ── Redis ───────────────────────────────────────────────────────────

export interface RedisServerInfo {
  version: string
  uptime: number
  connectedClients: number
  usedMemory: number
  totalKeys: number
  keyspaceHits: number
  keyspaceMisses: number
}

export interface RedisScanResult {
  keys: string[]
  cursor: string
  hasMore: boolean
}

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

export async function fetchRedisServerInfo(
  instrument: string,
): Promise<RedisServerInfo> {
  const data = await query<{ redisServerInfo: RedisServerInfo }>(
    REDIS_SERVER_INFO_QUERY,
    { instrument },
  )
  return data.redisServerInfo
}

export async function scanRedisKeys(
  instrument: string,
  cursor: string | null,
  pattern: string | null,
  count: number = 100,
): Promise<RedisScanResult> {
  const data = await query<{ redisScan: RedisScanResult }>(
    REDIS_SCAN_QUERY,
    { instrument, cursor, pattern, count },
    "network-only",
  )
  return data.redisScan
}

// ── Database ────────────────────────────────────────────────────────

export interface DatabaseSchema {
  name: string
  tableCount: number
}

export interface DatabaseTableSummary {
  name: string
  schema: string
  type: string
  rowCountEstimate: number
}

export interface DatabaseQueryResult {
  columns: { name: string; dataType: string }[]
  rows: string[][]
  rowCount: number
  executionTimeMs: number
  truncated: boolean
}

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

const DATABASE_QUERY_MUTATION = gql`
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
  const data = await query<{ databaseSchemas: DatabaseSchema[] }>(
    DATABASE_SCHEMAS_QUERY,
    { instrument },
  )
  return data.databaseSchemas ?? []
}

export async function fetchDatabaseTables(
  instrument: string,
  schema: string,
): Promise<DatabaseTableSummary[]> {
  const data = await query<{ databaseTables: DatabaseTableSummary[] }>(
    DATABASE_TABLES_QUERY,
    { instrument, schema },
  )
  return data.databaseTables ?? []
}

export async function executeDatabaseQuery(
  instrument: string,
  sql: string,
): Promise<DatabaseQueryResult> {
  const data = await mutate<{ executeDatabaseQuery: DatabaseQueryResult }>(
    DATABASE_QUERY_MUTATION,
    { instrument, sql },
  )
  return data.executeDatabaseQuery
}
