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

export interface SchemaRegistryConfig {
  compatibility: string
}

const SCHEMA_REGISTRY_CONFIG_QUERY = gql`
  query SchemaRegistryConfig($instrument: String!) {
    schemaRegistryConfig(instrument: $instrument) {
      compatibility
    }
  }
`

/** The registry's global default compatibility level. */
export async function fetchSchemaRegistryConfig(
  instrument: string,
): Promise<SchemaRegistryConfig> {
  const data = await query<{ schemaRegistryConfig: SchemaRegistryConfig }>(
    SCHEMA_REGISTRY_CONFIG_QUERY,
    { instrument },
  )
  return data.schemaRegistryConfig
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

// ── Kafka ───────────────────────────────────────────────────────────
//
// Read-only surface backed by `kafka.graphqls` (franz-go/kadm client).
// There are no throughput/rate fields — the KPI strip and lag view are
// derived client-side from these queries.

export interface KafkaTopic {
  name: string
  partitionCount: number
  replicationFactor: number
  internal: boolean
}

export interface KafkaPartition {
  id: number
  leader: number
  replicas: number[]
  inSyncReplicas: number[]
}

export interface KafkaConfigEntry {
  key: string
  value: string
}

export interface KafkaTopicDetail extends KafkaTopic {
  partitions: KafkaPartition[]
  configEntries: KafkaConfigEntry[]
  messageCount: number
}

export interface KafkaConsumerGroup {
  groupId: string
  state: string
  memberCount: number
  totalLag: number
}

export interface KafkaTopicPartition {
  topic: string
  partition: number
}

export interface KafkaGroupMember {
  clientId: string
  clientHost: string
  assignments: KafkaTopicPartition[]
}

export interface KafkaPartitionOffset {
  topic: string
  partition: number
  committedOffset: number
  endOffset: number
  lag: number
}

export interface KafkaConsumerGroupDetail {
  groupId: string
  state: string
  protocol: string
  protocolType: string
  members: KafkaGroupMember[]
  offsets: KafkaPartitionOffset[]
}

export interface KafkaMessage {
  partition: number
  offset: number
  /** Record timestamp in epoch milliseconds. */
  timestamp: number
  key: string | null
  value: string
}

/**
 * Preview read order: NEWEST tails the live end of the stream, OLDEST reads
 * from the earliest retained offsets (where the deterministic seed rows live).
 */
export type KafkaMessageOrder = "NEWEST" | "OLDEST"

const KAFKA_TOPICS_QUERY = gql`
  query KafkaTopics($instrument: String!) {
    kafkaTopics(instrument: $instrument) {
      name
      partitionCount
      replicationFactor
      internal
    }
  }
`

const KAFKA_TOPIC_QUERY = gql`
  query KafkaTopic($instrument: String!, $name: String!) {
    kafkaTopic(instrument: $instrument, name: $name) {
      name
      partitionCount
      replicationFactor
      internal
      messageCount
      partitions {
        id
        leader
        replicas
        inSyncReplicas
      }
      configEntries {
        key
        value
      }
    }
  }
`

const KAFKA_TOPIC_MESSAGES_QUERY = gql`
  query KafkaTopicMessages(
    $instrument: String!
    $topic: String!
    $limit: Int
    $order: KafkaMessageOrder
  ) {
    kafkaTopicMessages(
      instrument: $instrument
      topic: $topic
      limit: $limit
      order: $order
    ) {
      partition
      offset
      timestamp
      key
      value
    }
  }
`

const KAFKA_CONSUMER_GROUPS_QUERY = gql`
  query KafkaConsumerGroups($instrument: String!) {
    kafkaConsumerGroups(instrument: $instrument) {
      groupId
      state
      memberCount
      totalLag
    }
  }
`

const KAFKA_CONSUMER_GROUP_QUERY = gql`
  query KafkaConsumerGroup($instrument: String!, $groupId: String!) {
    kafkaConsumerGroup(instrument: $instrument, groupId: $groupId) {
      groupId
      state
      protocol
      protocolType
      members {
        clientId
        clientHost
        assignments {
          topic
          partition
        }
      }
      offsets {
        topic
        partition
        committedOffset
        endOffset
        lag
      }
    }
  }
`

export async function fetchKafkaTopics(
  instrument: string,
): Promise<KafkaTopic[]> {
  const data = await query<{ kafkaTopics: KafkaTopic[] }>(
    KAFKA_TOPICS_QUERY,
    { instrument },
    "network-only",
  )
  return data.kafkaTopics ?? []
}

export async function fetchKafkaTopic(
  instrument: string,
  name: string,
): Promise<KafkaTopicDetail> {
  const data = await query<{ kafkaTopic: KafkaTopicDetail }>(
    KAFKA_TOPIC_QUERY,
    {
      instrument,
      name,
    },
  )
  return data.kafkaTopic
}

/**
 * Preview records from a topic (throwaway server-side consumer). Order
 * defaults to NEWEST (live tail); pass "OLDEST" to read from the beginning.
 */
export async function fetchKafkaTopicMessages(
  instrument: string,
  topic: string,
  limit?: number,
  order?: KafkaMessageOrder,
): Promise<KafkaMessage[]> {
  const data = await query<{ kafkaTopicMessages: KafkaMessage[] }>(
    KAFKA_TOPIC_MESSAGES_QUERY,
    { instrument, topic, limit, order },
    "network-only",
  )
  return data.kafkaTopicMessages ?? []
}

export async function fetchKafkaConsumerGroups(
  instrument: string,
): Promise<KafkaConsumerGroup[]> {
  const data = await query<{ kafkaConsumerGroups: KafkaConsumerGroup[] }>(
    KAFKA_CONSUMER_GROUPS_QUERY,
    { instrument },
    "network-only",
  )
  return data.kafkaConsumerGroups ?? []
}

export async function fetchKafkaConsumerGroup(
  instrument: string,
  groupId: string,
): Promise<KafkaConsumerGroupDetail> {
  const data = await query<{ kafkaConsumerGroup: KafkaConsumerGroupDetail }>(
    KAFKA_CONSUMER_GROUP_QUERY,
    { instrument, groupId },
  )
  return data.kafkaConsumerGroup
}

// ── Connect instrument (config generator) ───────────────────────────

export interface InstrumentTestResult {
  ok: boolean
  message: string | null
  latencyMs: number | null
}

const TEST_INSTRUMENT_CONNECTION_MUTATION = gql`
  mutation TestInstrumentConnection(
    $type: String!
    $name: String!
    $config: JSON!
  ) {
    testInstrumentConnection(type: $type, name: $name, config: $config) {
      ok
      message
      latencyMs
    }
  }
`

/**
 * Test a candidate instrument connection without persisting or registering it.
 * The server builds a transient instrument and runs its lifecycle probe.
 */
export async function testInstrumentConnection(
  type: string,
  name: string,
  config: Record<string, unknown>,
): Promise<InstrumentTestResult> {
  const data = await mutate<{ testInstrumentConnection: InstrumentTestResult }>(
    TEST_INSTRUMENT_CONNECTION_MUTATION,
    { type, name, config },
  )
  return data.testInstrumentConnection
}

// ── Kafka seeding ───────────────────────────────────────────────────

export interface KafkaSeededTopic {
  topic: string
  /** Template domain from the seed catalog (e.g. "ecommerce", "iot"). */
  domain: string
  /** Whether the topic already existed in the broker when the seed ran. */
  existed: boolean
  /** Records already in the topic; 0 when the topic is absent. */
  existingRecords: number
  /** Topic was created (real run) / would be created (dry run). */
  created: boolean
  /** Skipped because the topic already holds records and skipNonEmpty was set. */
  skipped: boolean
  /** Records produced (real run) / that would be produced (dry run). */
  recordsProduced: number
  /** Per-topic failure; null when the topic seeded cleanly. */
  error: string | null
}

export interface KafkaSeedResult {
  topics: KafkaSeededTopic[]
  recordsProduced: number
  skipped: string[]
  dryRun: boolean
}

export interface SeedKafkaTopicsOptions {
  /** Widen from this project's topics to the entire sample catalog. */
  allTopics?: boolean
  /** Consult the broker and report the plan without producing. */
  dryRun?: boolean
  /** Server default is TRUE — pass false to force-append into populated topics. */
  skipNonEmpty?: boolean
  /** Restrict the run to these catalog domains (with allTopics). */
  domains?: string[]
}

const SEED_KAFKA_TOPICS_MUTATION = gql`
  mutation SeedKafkaTopics(
    $instrument: String!
    $allTopics: Boolean
    $dryRun: Boolean
    $skipNonEmpty: Boolean
    $domains: [String!]
  ) {
    seedKafkaTopics(
      instrument: $instrument
      allTopics: $allTopics
      dryRun: $dryRun
      skipNonEmpty: $skipNonEmpty
      domains: $domains
    ) {
      topics {
        topic
        domain
        existed
        existingRecords
        created
        skipped
        recordsProduced
        error
      }
      recordsProduced
      skipped
      dryRun
    }
  }
`

/**
 * Seed sample data into a Kafka instrument's topics. Governed server-side by
 * the environment seeding policy (never permitted in production). By default
 * only this project's topics (those already present in the broker) are seeded
 * and already-populated topics are skipped; see SeedKafkaTopicsOptions for the
 * dials. Dry runs consult the broker, so the reported plan matches a real run.
 */
export async function seedKafkaTopics(
  instrument: string,
  opts: SeedKafkaTopicsOptions = {},
): Promise<KafkaSeedResult> {
  const data = await mutate<{ seedKafkaTopics: KafkaSeedResult }>(
    SEED_KAFKA_TOPICS_MUTATION,
    {
      instrument,
      allTopics: opts.allTopics,
      dryRun: opts.dryRun,
      skipNonEmpty: opts.skipNonEmpty,
      domains: opts.domains,
    },
  )
  return data.seedKafkaTopics
}
