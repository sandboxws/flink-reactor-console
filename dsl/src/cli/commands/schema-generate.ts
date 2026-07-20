import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as clack from "@clack/prompts"
import type { Command } from "commander"
import { Effect } from "effect"
import pc from "picocolors"
import { introspectKafkaSubject } from "@/cli/connectors/kafka-registry-introspect.js"
import {
  introspectPostgresTables,
  splitQualifiedTable,
} from "@/cli/connectors/postgres-introspect.js"
import { autoSelectEnvironment, loadConfig } from "@/cli/discovery.js"
import { runCommand } from "@/cli/effect-runner.js"
import { emitSchemaModule } from "@/codegen/schema-emit.js"
import type { IntrospectedColumn } from "@/codegen/schema-introspect.js"
import type { SourcesConfig } from "@/core/config.js"
import type { ResolvedServicesConfig } from "@/core/config-resolver.js"
import { resolveConfig } from "@/core/config-resolver.js"
import { resolveEnvVars } from "@/core/env-var.js"
import { CliError } from "@/core/errors.js"

export interface SchemaGenerateOptions {
  readonly source?: string
  readonly all?: boolean
  readonly fields?: string
  readonly outdir?: string
  readonly registryUrl?: string
  readonly pgConnectionString?: string
  readonly env?: string
  readonly force?: boolean
  /** Test hook — defaults to `process.cwd()`. */
  readonly projectDir?: string
}

// A `SourceDefinition` after `resolveEnvVars()` has replaced every env()
// marker with a string. `Resolved<T>` can't express this for interfaces
// (see config-resolver.ts), so we model the resolved shape explicitly and
// cast once at the resolution boundary.
interface ResolvedPostgresSource {
  readonly type: "postgres" | "jdbc"
  readonly service?: string
  readonly connectionString?: string
  readonly table: string
  readonly schema?: string
}
interface ResolvedKafkaSource {
  readonly type: "kafka"
  readonly service?: string
  readonly topic: string
  readonly registryUrl?: string
  readonly subject?: string
  readonly format?: "avro" | "json-schema"
  readonly auth?: { readonly username: string; readonly password: string }
}
type ResolvedSource = ResolvedPostgresSource | ResolvedKafkaSource

// ── Command registration ────────────────────────────────────────────

export function registerSchemaGenerateSubcommand(schema: Command): void {
  schema
    .command("generate")
    .description(
      "Generate schemas/<name>.ts modules from configured data sources",
    )
    .argument(
      "[source]",
      "Source name from config.sources (omit to pick interactively)",
    )
    .option("--all", "Include all fields (skip the interactive subset picker)")
    .option("--fields <list>", "Comma-separated field names to include")
    .option("--outdir <dir>", "Output directory", "schemas")
    .option(
      "--registry-url <url>",
      "Confluent Schema Registry base URL (Kafka sources)",
    )
    .option(
      "--pg-connection-string <url>",
      "Postgres connection string (Postgres/JDBC sources)",
    )
    .option("-e, --env <name>", "Environment name from flink-reactor.config.ts")
    .option("--force", "Overwrite existing schema files")
    .action(
      async (
        source: string | undefined,
        opts: {
          all?: boolean
          fields?: string
          outdir?: string
          registryUrl?: string
          pgConnectionString?: string
          env?: string
          force?: boolean
        },
      ) => {
        await runCommand(
          Effect.tryPromise({
            try: () => runSchemaGenerate({ source, ...opts }),
            catch: (err) =>
              new CliError({
                reason: "invalid_args",
                message: (err as Error).message,
              }),
          }),
        )
      },
    )
}

// ── Main flow ───────────────────────────────────────────────────────

export async function runSchemaGenerate(
  opts: SchemaGenerateOptions,
): Promise<void> {
  const projectDir = opts.projectDir ?? process.cwd()

  const config = await loadConfig(projectDir)
  if (!config) {
    throw new Error(
      "No flink-reactor.config.ts found. Run this from a FlinkReactor project.",
    )
  }
  const sources = config.sources
  if (!sources || Object.keys(sources).length === 0) {
    throw new Error(
      "No `sources` declared in flink-reactor.config.ts. Add a `sources` block, " +
        "then run `flink-reactor schema generate`.",
    )
  }

  // Resolve services for the connection fallback (env() markers replaced,
  // per-env overrides merged). Sources themselves are read from the raw
  // config — `resolveConfig` intentionally drops unknown top-level keys.
  const envName =
    opts.env ??
    (config.environments
      ? autoSelectEnvironment(config.environments)
      : undefined)
  const services = resolveConfig(config, envName).services

  const isTTY = Boolean(process.stdout.isTTY)

  const names = await selectSources(opts.source, sources, isTTY)
  if (names === null) return // cancelled

  const written: string[] = []
  for (const name of names) {
    const columns = await introspectSource(name, sources, services, opts)
    const selected = await selectFields(name, columns, opts, isTTY)
    if (selected === null) return // cancelled
    if (selected.length === 0) {
      throw new Error(`No fields selected for source '${name}'.`)
    }
    const primaryKey = selected
      .filter((col) => col.constraints.includes("PK"))
      .map((col) => col.name)
    const content = emitSchemaModule(name, selected, {
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
    })
    const filePath = writeSchemaFile(
      projectDir,
      opts.outdir ?? "schemas",
      name,
      content,
      Boolean(opts.force),
    )
    written.push(filePath)
    console.log(`  ${pc.green("✓")} Created ${pc.dim(filePath)}`)
  }

  if (written.length > 0) {
    console.log(
      `\n  Generated ${pc.bold(String(written.length))} schema${written.length === 1 ? "" : "s"}.`,
    )
  }
}

// ── Source selection ────────────────────────────────────────────────

async function selectSources(
  sourceArg: string | undefined,
  sources: SourcesConfig,
  isTTY: boolean,
): Promise<string[] | null> {
  if (sourceArg) {
    if (!(sourceArg in sources)) {
      throw new Error(
        `Unknown source '${sourceArg}'. Available: ${Object.keys(sources).join(", ")}`,
      )
    }
    return [sourceArg]
  }

  if (!isTTY) {
    throw new Error(
      "No source specified. Pass a source name, e.g. `flink-reactor schema generate <name>`.",
    )
  }

  const picked = await clack.multiselect({
    message: "Which sources would you like to generate schemas for?",
    options: Object.keys(sources).map((name) => ({
      value: name,
      label: name,
      hint: sources[name].type,
    })),
    required: true,
  })
  if (clack.isCancel(picked)) {
    clack.cancel("Operation cancelled.")
    return null
  }
  return picked
}

// ── Field selection ─────────────────────────────────────────────────

async function selectFields(
  name: string,
  columns: readonly IntrospectedColumn[],
  opts: SchemaGenerateOptions,
  isTTY: boolean,
): Promise<IntrospectedColumn[] | null> {
  // Explicit --fields wins over everything.
  if (opts.fields) {
    const wanted = opts.fields
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const available = new Set(columns.map((c) => c.name))
    const unknown = wanted.filter((w) => !available.has(w))
    if (unknown.length > 0) {
      throw new Error(
        `Unknown field(s) for source '${name}': ${unknown.join(", ")}. ` +
          `Available: ${columns.map((c) => c.name).join(", ")}`,
      )
    }
    // Preserve introspection order regardless of --fields order.
    return columns.filter((c) => wanted.includes(c.name))
  }

  if (opts.all || !isTTY) return [...columns]

  const mode = await clack.select({
    message: `Fields for '${name}' (${columns.length} available)?`,
    options: [
      { value: "all", label: "All fields" },
      { value: "subset", label: "Choose a subset" },
    ],
  })
  if (clack.isCancel(mode)) {
    clack.cancel("Operation cancelled.")
    return null
  }
  if (mode === "all") return [...columns]

  const picked = await clack.multiselect({
    message: "Select the fields to include",
    options: columns.map((c) => ({
      value: c.name,
      label: c.name,
      hint:
        c.constraints.length > 0
          ? `${c.type} · ${c.constraints.join(", ")}`
          : c.type,
    })),
    required: true,
  })
  if (clack.isCancel(picked)) {
    clack.cancel("Operation cancelled.")
    return null
  }
  // Preserve introspection order regardless of pick order.
  const pickedSet = new Set(picked)
  return columns.filter((c) => pickedSet.has(c.name))
}

// ── Introspection dispatch ──────────────────────────────────────────

async function introspectSource(
  name: string,
  sources: SourcesConfig,
  services: ResolvedServicesConfig,
  opts: SchemaGenerateOptions,
): Promise<IntrospectedColumn[]> {
  // Resolve env() markers on just this source (avoids throwing on unrelated
  // sources whose env vars may be unset). resolveEnvVars replaces every
  // marker with a string at runtime; the cast reflects that.
  const def = resolveEnvVars(sources[name]) as ResolvedSource

  if (def.type === "kafka") {
    const registryUrl =
      opts.registryUrl ??
      def.registryUrl ??
      process.env.FR_SCHEMA_REGISTRY_URL ??
      serviceRegistryUrl(services, def.service ?? "kafka")
    if (!registryUrl) {
      throw new Error(
        `Kafka source '${name}' needs a Schema Registry URL. Set ` +
          "`services.kafka.schemaRegistryUrl`, the source's `registryUrl`, " +
          "`--registry-url`, or FR_SCHEMA_REGISTRY_URL.",
      )
    }
    return [
      ...(await introspectKafkaSubject({
        registryUrl,
        topic: def.topic,
        subject: def.subject,
        auth: def.auth,
      })),
    ]
  }

  // postgres / jdbc
  const connectionString =
    opts.pgConnectionString ??
    def.connectionString ??
    process.env.FR_PG_CONNECTION_STRING ??
    assemblePgUrl(services, def.service ?? "postgres", name)
  if (!connectionString) {
    throw new Error(
      `${def.type} source '${name}' needs a connection. Set the source's ` +
        "`connectionString`, a `services.postgres` block, `--pg-connection-string`, " +
        "or FR_PG_CONNECTION_STRING.",
    )
  }

  const { schema, table } = splitTable(def.table, def.schema)
  const result = await introspectPostgresTables({
    connectionString,
    schemaList: [schema],
    tableList: [table],
  })
  const cols = result.get(`${schema}.${table}`)
  if (!cols || cols.length === 0) {
    throw new Error(
      `No columns found for '${schema}.${table}' (source '${name}'). ` +
        "Check the table exists and the connection is reachable.",
    )
  }
  return [...cols]
}

// ── Connection helpers ──────────────────────────────────────────────

function splitTable(
  table: string,
  schemaOverride?: string,
): { schema: string; table: string } {
  if (table.includes(".")) return splitQualifiedTable(table)
  return { schema: schemaOverride ?? "public", table }
}

function serviceRecord(
  services: ResolvedServicesConfig,
  key: string,
): Record<string, unknown> | undefined {
  const entry = (services as Record<string, unknown>)[key]
  if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
    return entry as Record<string, unknown>
  }
  return undefined
}

function serviceRegistryUrl(
  services: ResolvedServicesConfig,
  key: string,
): string | undefined {
  const entry = serviceRecord(services, key)
  const url = entry?.schemaRegistryUrl
  return typeof url === "string" ? url : undefined
}

function assemblePgUrl(
  services: ResolvedServicesConfig,
  key: string,
  sourceName: string,
): string | undefined {
  const entry = serviceRecord(services, key)
  if (!entry) return undefined

  const password = entry.password
  if (password !== undefined && typeof password !== "string") {
    // A secretRef() password cannot be read on the host for local
    // introspection — resolveEnvVars only resolves env() markers.
    throw new Error(
      `Cannot introspect source '${sourceName}': the '${key}' service password ` +
        "is a secretRef(), which isn't available on the host. Set the source's " +
        "`connectionString`, use env() for the password, or pass --pg-connection-string.",
    )
  }

  const user = typeof entry.user === "string" ? entry.user : "reactor"
  const pass = typeof password === "string" ? password : "reactor"
  const port =
    typeof entry.externalPort === "number" ? entry.externalPort : 5433
  const database =
    typeof entry.database === "string" ? entry.database : "postgres"
  return `postgresql://${user}:${pass}@localhost:${port}/${database}`
}

// ── File writing ────────────────────────────────────────────────────

function writeSchemaFile(
  projectDir: string,
  outdir: string,
  name: string,
  content: string,
  force: boolean,
): string {
  const dir = join(projectDir, outdir)
  const filePath = join(dir, `${name}.ts`)
  if (!force && existsSync(filePath)) {
    throw new Error(`${filePath} already exists. Pass --force to overwrite.`)
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, content, "utf-8")
  return filePath
}
