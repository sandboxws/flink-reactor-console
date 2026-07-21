/**
 * Declarative field specs for the Connect Instrument wizard.
 *
 * One source of truth drives both the step-2 form and the generated YAML.
 * Field keys mirror each Go `Config` struct verbatim, so the emitted config
 * is valid to paste into `server/config/<env>.yml`:
 *   kafka          → server/internal/instruments/kafka/instrument.go
 *   database       → server/internal/instruments/database/instrument.go
 *   yugabyte       → server/internal/instruments/database/instrument.go (Postgres-wire)
 *   redis          → server/internal/instruments/redis/instrument.go
 *   schemaregistry → server/internal/instruments/schemaregistry/{instrument,client}.go
 *   fluss          → server/internal/instruments/fluss/config.go
 *   datalake       → server/internal/instruments/datalake/config.go
 */

export type FieldKind =
  | "text"
  | "number"
  | "select"
  | "secret"
  | "list"
  | "keyvalue"
  | "group"

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  help?: string
  placeholder?: string
  options?: string[] // select
  fields?: FieldDef[] // group
}

export interface InstrumentTypeOption {
  value: string
  label: string
  supported: boolean
  note?: string
}

/** Types the server can actually construct, plus aspirational (disabled) ones. */
export const INSTRUMENT_TYPES: InstrumentTypeOption[] = [
  { value: "kafka", label: "Kafka", supported: true },
  { value: "database", label: "Database · Postgres / MySQL", supported: true },
  {
    value: "yugabyte",
    label: "YugabyteDB · Postgres-compatible",
    supported: true,
  },
  { value: "redis", label: "Redis", supported: true },
  { value: "schemaregistry", label: "Schema Registry", supported: true },
  { value: "fluss", label: "Fluss", supported: true },
  { value: "datalake", label: "Datalake · Iceberg / Paimon", supported: true },
  { value: "pinot", label: "Pinot", supported: false, note: "coming soon" },
  { value: "druid", label: "Druid", supported: false, note: "coming soon" },
  {
    value: "custom",
    label: "Custom DSL adapter",
    supported: false,
    note: "coming soon",
  },
]

export const INSTRUMENT_FIELD_SPECS: Record<string, FieldDef[]> = {
  kafka: [
    {
      key: "brokers",
      label: "Brokers",
      kind: "list",
      required: true,
      help: "Comma-separated host:port list",
      placeholder: "localhost:9092, broker2:9092",
    },
    {
      key: "sasl",
      label: "SASL",
      kind: "group",
      fields: [
        {
          key: "mechanism",
          label: "Mechanism",
          kind: "select",
          required: true,
          options: ["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512"],
        },
        { key: "username", label: "Username", kind: "text", required: true },
        { key: "password", label: "Password", kind: "secret", required: true },
      ],
    },
    {
      key: "tls",
      label: "TLS",
      kind: "group",
      fields: [
        { key: "caCert", label: "CA cert path", kind: "text" },
        { key: "clientCert", label: "Client cert path", kind: "text" },
        { key: "clientKey", label: "Client key path", kind: "secret" },
      ],
    },
  ],
  database: [
    {
      key: "dsn",
      label: "DSN",
      kind: "secret",
      required: true,
      help: "Connection string (may embed credentials)",
      placeholder: "postgres://user:pass@host:5432/db?sslmode=disable",
    },
    {
      key: "driver",
      label: "Driver",
      kind: "select",
      required: true,
      options: ["postgres", "mysql"],
    },
    {
      key: "statementTimeout",
      label: "Statement timeout (ms)",
      kind: "number",
      help: "0 disables the timeout",
    },
    {
      key: "maxRows",
      label: "Max rows",
      kind: "number",
      help: "Result row cap",
    },
  ],
  yugabyte: [
    {
      key: "dsn",
      label: "DSN",
      kind: "secret",
      required: true,
      help: "YSQL connection string (Postgres-wire; YugabyteDB defaults to port 5433)",
      placeholder:
        "postgres://yugabyte:yugabyte@host:5433/yugabyte?sslmode=disable",
    },
    // No `driver` field: the server defaults a yugabyte instrument to the
    // Postgres dialect (YSQL is wire-compatible). See database/instrument.go.
    {
      key: "statementTimeout",
      label: "Statement timeout (ms)",
      kind: "number",
      help: "0 disables the timeout",
    },
    {
      key: "maxRows",
      label: "Max rows",
      kind: "number",
      help: "Result row cap",
    },
  ],
  redis: [
    {
      key: "addr",
      label: "Address",
      kind: "text",
      required: true,
      placeholder: "localhost:6379",
    },
    { key: "password", label: "Password", kind: "secret" },
    { key: "db", label: "DB index", kind: "number" },
    {
      key: "tls",
      label: "TLS",
      kind: "group",
      fields: [
        { key: "caCert", label: "CA cert path", kind: "text" },
        { key: "clientCert", label: "Client cert path", kind: "text" },
        { key: "clientKey", label: "Client key path", kind: "secret" },
      ],
    },
  ],
  schemaregistry: [
    {
      key: "url",
      label: "URL",
      kind: "text",
      required: true,
      placeholder: "http://localhost:8081",
    },
    {
      key: "auth",
      label: "Auth",
      kind: "group",
      fields: [
        {
          key: "type",
          label: "Type",
          kind: "select",
          required: true,
          options: ["none", "basic", "bearer"],
        },
        { key: "username", label: "Username", kind: "text" },
        { key: "password", label: "Password", kind: "secret" },
        { key: "token", label: "Bearer token", kind: "secret" },
      ],
    },
  ],
  fluss: [
    {
      key: "bootstrapServers",
      label: "Bootstrap servers",
      kind: "text",
      required: true,
      placeholder: "localhost:9123",
    },
    { key: "adminEndpoint", label: "Admin endpoint", kind: "text" },
    {
      key: "zookeeperEnsemble",
      label: "ZooKeeper ensemble",
      kind: "text",
      help: "Optional; enables a finer health probe",
    },
    { key: "saslUsername", label: "SASL username", kind: "text" },
    { key: "saslPassword", label: "SASL password", kind: "secret" },
    {
      key: "saslMechanism",
      label: "SASL mechanism",
      kind: "text",
      help: "e.g. SCRAM-SHA-512 (leave blank for no SASL)",
    },
  ],
  datalake: [
    {
      key: "catalogType",
      label: "Catalog type",
      kind: "select",
      required: true,
      options: ["iceberg-rest", "paimon-fs", "paimon-hive"],
    },
    {
      key: "endpoint",
      label: "Endpoint",
      kind: "text",
      help: "Required for iceberg-rest (REST catalog URL)",
      placeholder: "http://localhost:8181",
    },
    {
      key: "warehouse",
      label: "Warehouse",
      kind: "text",
      placeholder: "s3://bucket/warehouse",
    },
    {
      key: "properties",
      label: "Properties",
      kind: "keyvalue",
      help: "One key=value per line",
    },
  ],
}

/** Placeholder written in place of a secret value in the generated YAML. */
export const SECRET_PLACEHOLDER = "<set-me>"

/** Coerce a raw form string to the JSON type its field kind implies. */
function coerce(kind: FieldKind, raw: string): unknown {
  switch (kind) {
    case "number":
      return Number(raw)
    case "list":
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    case "keyvalue": {
      const obj: Record<string, string> = {}
      for (const line of raw.split("\n")) {
        const idx = line.indexOf("=")
        if (idx <= 0) continue
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim()
        if (k) obj[k] = v
      }
      return obj
    }
    default:
      return raw
  }
}

function isEmpty(kind: FieldKind, raw: string | undefined): boolean {
  if (raw === undefined) return true
  if (kind === "keyvalue" || kind === "list") return raw.trim().length === 0
  return raw.length === 0
}

/**
 * Build the instrument config object from flat form values. Dotted keys address
 * group fields (`sasl.username`); a group is included only when at least one of
 * its fields has a value. TLS groups get an explicit `enabled: true`.
 */
export function buildConfig(
  type: string,
  values: Record<string, string>,
): Record<string, unknown> {
  const spec = INSTRUMENT_FIELD_SPECS[type] ?? []
  const config: Record<string, unknown> = {}

  for (const field of spec) {
    if (field.kind === "group") {
      const nested: Record<string, unknown> = {}
      for (const sub of field.fields ?? []) {
        const raw = values[`${field.key}.${sub.key}`]
        if (!isEmpty(sub.kind, raw))
          nested[sub.key] = coerce(sub.kind, raw ?? "")
      }
      if (Object.keys(nested).length > 0) {
        if (field.key === "tls") nested.enabled = true
        config[field.key] = nested
      }
      continue
    }
    const raw = values[field.key]
    if (!isEmpty(field.kind, raw))
      config[field.key] = coerce(field.kind, raw ?? "")
  }

  return config
}

/** Labels of required fields that are still empty (groups only when partially filled). */
export function requiredMissing(
  type: string,
  values: Record<string, string>,
): string[] {
  const spec = INSTRUMENT_FIELD_SPECS[type] ?? []
  const missing: string[] = []

  for (const field of spec) {
    if (field.kind === "group") {
      const subs = field.fields ?? []
      const anyFilled = subs.some(
        (s) => !isEmpty(s.kind, values[`${field.key}.${s.key}`]),
      )
      if (!anyFilled) continue // group is optional and untouched
      for (const sub of subs) {
        if (
          sub.required &&
          isEmpty(sub.kind, values[`${field.key}.${sub.key}`])
        ) {
          missing.push(`${field.label} · ${sub.label}`)
        }
      }
      continue
    }
    if (field.required && isEmpty(field.kind, values[field.key])) {
      missing.push(field.label)
    }
  }

  return missing
}

/** Secret field paths ("dsn", "sasl.password") for a type, used to mask YAML. */
function secretPaths(type: string): string[] {
  const spec = INSTRUMENT_FIELD_SPECS[type] ?? []
  const paths: string[] = []
  for (const field of spec) {
    if (field.kind === "secret") paths.push(field.key)
    if (field.kind === "group") {
      for (const sub of field.fields ?? []) {
        if (sub.kind === "secret") paths.push(`${field.key}.${sub.key}`)
      }
    }
  }
  return paths
}

function yamlScalar(v: unknown): string {
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return JSON.stringify(String(v))
}

function emitYaml(value: unknown, indent: number): string[] {
  const pad = " ".repeat(indent)
  if (Array.isArray(value)) {
    return value.map((item) => `${pad}- ${yamlScalar(item)}`)
  }
  if (value && typeof value === "object") {
    const lines: string[] = []
    for (const [k, v] of Object.entries(value)) {
      if (v && typeof v === "object") {
        lines.push(`${pad}${k}:`)
        lines.push(...emitYaml(v, indent + 2))
      } else {
        lines.push(`${pad}${k}: ${yamlScalar(v)}`)
      }
    }
    return lines
  }
  return [`${pad}${yamlScalar(value)}`]
}

/** Deep-clone `config` and replace secret values with a placeholder. */
export function maskSecrets(
  type: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const clone: Record<string, unknown> = structuredClone(config)
  for (const path of secretPaths(type)) {
    const [head, tail] = path.split(".")
    if (tail === undefined) {
      if (clone[head] !== undefined) clone[head] = SECRET_PLACEHOLDER
    } else {
      const group = clone[head]
      if (group && typeof group === "object") {
        const g = group as Record<string, unknown>
        if (g[tail] !== undefined) g[tail] = SECRET_PLACEHOLDER
      }
    }
  }
  return clone
}

/**
 * Emit the `instruments:` YAML block for a configured instrument. Secret values
 * are masked by default so a copied config never carries a real credential.
 */
export function toYaml(
  type: string,
  name: string,
  config: Record<string, unknown>,
  mask = true,
): string {
  const emitted = mask ? maskSecrets(type, config) : config
  return [
    "instruments:",
    `  - type: ${yamlScalar(type)}`,
    `    name: ${yamlScalar(name)}`,
    "    config:",
    ...emitYaml(emitted, 6),
  ].join("\n")
}
