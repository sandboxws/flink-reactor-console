// ---------------------------------------------------------------------------
// Dashboard configuration — server-side only
// ---------------------------------------------------------------------------

export interface ClusterEntry {
  name: string
  url: string
  default?: boolean
}

export interface DashboardConfig {
  // Core connection
  flinkRestUrl: string | null
  dashboardPort: number

  // Auth
  authType: "none" | "basic" | "token"
  authUsername?: string
  authPassword?: string
  authToken?: string

  // SSL/TLS
  sslEnabled: boolean
  sslCaPath?: string

  // Behavior
  pollIntervalMs: number
  logBufferSize: number

  // Display
  clusterDisplayName: string

  // Multi-cluster
  clusters: ClusterEntry[]

  // RBAC
  rbacEnabled: boolean
  rbacProvider?: "basic" | "oidc"
  rbacRoles?: Record<string, string[]>

  // Observability
  prometheusUrl?: string
  prometheusEnabled: boolean

  // Alerts
  alertWebhookUrl?: string
  alertWebhookEnabled: boolean

  // Runtime mode
  mockMode: boolean
}

/**
 * Subset of config safe to expose to the browser.
 * Never include auth credentials, SSL paths, or webhook URLs here.
 */
export interface PublicDashboardConfig {
  pollIntervalMs: number
  logBufferSize: number
  clusterDisplayName: string
  mockMode: boolean
  clusters: string[]
  rbacEnabled: boolean
  prometheusEnabled: boolean
  alertWebhookEnabled: boolean
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback
  return value === "true" || value === "1"
}

function parseInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

function parseAuthType(value: string | undefined): "none" | "basic" | "token" {
  if (value === "basic" || value === "token") return value
  return "none"
}

function parseMockMode(
  value: string | undefined,
  hasFlinkUrl: boolean,
): boolean {
  if (value === "on") return true
  if (value === "off") return false
  // "auto" (default) — mock when no Flink URL is configured
  return !hasFlinkUrl
}

function parseClusters(value: string | undefined): ClusterEntry[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is ClusterEntry =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as ClusterEntry).name === "string" &&
        typeof (c as ClusterEntry).url === "string",
    )
  } catch {
    return []
  }
}

function parseRbacRoles(
  value: string | undefined,
): Record<string, string[]> | undefined {
  if (!value) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== "object" || parsed === null) return undefined
    return parsed as Record<string, string[]>
  } catch {
    return undefined
  }
}

function parseRbacProvider(
  value: string | undefined,
): "basic" | "oidc" | undefined {
  if (value === "basic" || value === "oidc") return value
  return undefined
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigValidationError"
  }
}

function validate(config: DashboardConfig): void {
  if (config.authType === "basic") {
    if (!config.authUsername || !config.authPassword) {
      throw new ConfigValidationError(
        "FLINK_AUTH_TYPE=basic requires both FLINK_AUTH_USERNAME and FLINK_AUTH_PASSWORD",
      )
    }
  }

  if (config.authType === "token") {
    if (!config.authToken) {
      throw new ConfigValidationError(
        "FLINK_AUTH_TYPE=token requires FLINK_AUTH_TOKEN",
      )
    }
  }

  if (config.sslEnabled && config.sslCaPath) {
    // Just a sanity check — actual file existence is validated at connect time
    if (config.sslCaPath.length === 0) {
      throw new ConfigValidationError("FLINK_SSL_CA_PATH is set but empty")
    }
  }

  if (config.rbacEnabled && !config.rbacProvider) {
    throw new ConfigValidationError(
      "DASHBOARD_RBAC_ENABLED=true requires DASHBOARD_RBAC_PROVIDER",
    )
  }

  if (config.prometheusEnabled && !config.prometheusUrl) {
    throw new ConfigValidationError(
      "PROMETHEUS_ENABLED=true requires PROMETHEUS_URL",
    )
  }

  if (config.alertWebhookEnabled && !config.alertWebhookUrl) {
    throw new ConfigValidationError(
      "ALERT_WEBHOOK_ENABLED=true requires ALERT_WEBHOOK_URL",
    )
  }
}

// ---------------------------------------------------------------------------
// Main loader (cached singleton)
// ---------------------------------------------------------------------------

let cached: DashboardConfig | null = null

export function getConfig(): DashboardConfig {
  if (cached) return cached

  const env = process.env
  const flinkRestUrl = env.FLINK_REST_URL || null

  const config: DashboardConfig = {
    flinkRestUrl,
    // biome-ignore lint/correctness/useParseIntRadix: custom parseInt with fallback parameter, not the global parseInt
    dashboardPort: parseInt(env.DASHBOARD_PORT, 3001),

    authType: parseAuthType(env.FLINK_AUTH_TYPE),
    authUsername: env.FLINK_AUTH_USERNAME || undefined,
    authPassword: env.FLINK_AUTH_PASSWORD || undefined,
    authToken: env.FLINK_AUTH_TOKEN || undefined,

    sslEnabled: parseBool(env.FLINK_SSL_ENABLED, false),
    sslCaPath: env.FLINK_SSL_CA_PATH || undefined,

    // biome-ignore lint/correctness/useParseIntRadix: custom parseInt with fallback parameter, not the global parseInt
    pollIntervalMs: parseInt(env.DASHBOARD_POLL_INTERVAL, 5000),
    // biome-ignore lint/correctness/useParseIntRadix: custom parseInt with fallback parameter, not the global parseInt
    logBufferSize: parseInt(env.DASHBOARD_LOG_BUFFER_SIZE, 100000),

    clusterDisplayName: env.CLUSTER_DISPLAY_NAME || "Default Cluster",

    clusters: parseClusters(env.FLINK_CLUSTERS),

    rbacEnabled: parseBool(env.DASHBOARD_RBAC_ENABLED, false),
    rbacProvider: parseRbacProvider(env.DASHBOARD_RBAC_PROVIDER),
    rbacRoles: parseRbacRoles(env.DASHBOARD_RBAC_ROLES),

    prometheusUrl: env.PROMETHEUS_URL || undefined,
    prometheusEnabled: parseBool(env.PROMETHEUS_ENABLED, false),

    alertWebhookUrl: env.ALERT_WEBHOOK_URL || undefined,
    alertWebhookEnabled: parseBool(env.ALERT_WEBHOOK_ENABLED, false),

    mockMode: parseMockMode(env.DASHBOARD_MOCK_MODE, !!flinkRestUrl),
  }

  validate(config)
  cached = config
  return config
}

/**
 * Extract browser-safe subset of the config.
 */
export function getPublicConfig(): PublicDashboardConfig {
  const config = getConfig()
  return {
    pollIntervalMs: config.pollIntervalMs,
    logBufferSize: config.logBufferSize,
    clusterDisplayName: config.clusterDisplayName,
    mockMode: config.mockMode,
    clusters: config.clusters.map((c) => c.name),
    rbacEnabled: config.rbacEnabled,
    prometheusEnabled: config.prometheusEnabled,
    alertWebhookEnabled: config.alertWebhookEnabled,
  }
}

/**
 * Reset cached config — used by CLI when switching environments.
 */
export function resetConfig(): void {
  cached = null
}
