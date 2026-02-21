// ---------------------------------------------------------------------------
// Dashboard configuration — server-side only
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";

export interface ClusterEntry {
  name: string;
  url: string;
  default?: boolean;
}

export interface DashboardConfig {
  // Core connection
  flinkRestUrl: string | null;
  dashboardPort: number;

  // Auth
  authType: "none" | "basic" | "token";
  authUsername?: string;
  authPassword?: string;
  authToken?: string;

  // SSL/TLS
  sslEnabled: boolean;
  sslCaPath?: string;

  // Behavior
  pollIntervalMs: number;
  logBufferSize: number;

  // Display
  clusterDisplayName: string;

  // Multi-cluster
  clusters: ClusterEntry[];

  // RBAC
  rbacEnabled: boolean;
  rbacProvider?: "basic" | "oidc";
  rbacRoles?: Record<string, string[]>;

  // Observability
  prometheusUrl?: string;
  prometheusEnabled: boolean;

  // Alerts
  alertWebhookUrl?: string;
  alertWebhookEnabled: boolean;

  // Runtime mode
  mockMode: boolean;
}

/**
 * Subset of config safe to expose to the browser.
 * Never include auth credentials, SSL paths, or webhook URLs here.
 */
export interface PublicDashboardConfig {
  pollIntervalMs: number;
  logBufferSize: number;
  clusterDisplayName: string;
  mockMode: boolean;
  clusters: string[];
  rbacEnabled: boolean;
  prometheusEnabled: boolean;
  alertWebhookEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Resolved JSON shape (written by CLI, read by dashboard)
// ---------------------------------------------------------------------------

interface ResolvedDashboardJson {
  _version: number;
  flinkRestUrl?: string;
  dashboardPort?: number;
  authType?: string;
  authUsername?: string;
  authPassword?: string;
  authToken?: string;
  sslEnabled?: boolean;
  sslCaPath?: string;
  pollIntervalMs?: number;
  logBufferSize?: number;
  clusterDisplayName?: string;
  mockMode?: boolean;
  rbacEnabled?: boolean;
  rbacProvider?: string;
  rbacRoles?: Record<string, string[]>;
  prometheusUrl?: string;
  prometheusEnabled?: boolean;
  alertWebhookUrl?: string;
  alertWebhookEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function parseInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function parseAuthType(
  value: string | undefined,
): "none" | "basic" | "token" {
  if (value === "basic" || value === "token") return value;
  return "none";
}

function parseMockMode(
  value: string | undefined,
  hasFlinkUrl: boolean,
): boolean {
  if (value === "on") return true;
  if (value === "off") return false;
  // "auto" (default) — mock when no Flink URL is configured
  return !hasFlinkUrl;
}

function parseClusters(value: string | undefined): ClusterEntry[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is ClusterEntry =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as ClusterEntry).name === "string" &&
        typeof (c as ClusterEntry).url === "string",
    );
  } catch {
    return [];
  }
}

function parseRbacRoles(
  value: string | undefined,
): Record<string, string[]> | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    return parsed as Record<string, string[]>;
  } catch {
    return undefined;
  }
}

function parseRbacProvider(
  value: string | undefined,
): "basic" | "oidc" | undefined {
  if (value === "basic" || value === "oidc") return value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

function validate(config: DashboardConfig): void {
  if (config.authType === "basic") {
    if (!config.authUsername || !config.authPassword) {
      throw new ConfigValidationError(
        "FLINK_AUTH_TYPE=basic requires both FLINK_AUTH_USERNAME and FLINK_AUTH_PASSWORD",
      );
    }
  }

  if (config.authType === "token") {
    if (!config.authToken) {
      throw new ConfigValidationError(
        "FLINK_AUTH_TYPE=token requires FLINK_AUTH_TOKEN",
      );
    }
  }

  if (config.sslEnabled && config.sslCaPath) {
    // Just a sanity check — actual file existence is validated at connect time
    if (config.sslCaPath.length === 0) {
      throw new ConfigValidationError(
        "FLINK_SSL_CA_PATH is set but empty",
      );
    }
  }

  if (config.rbacEnabled && !config.rbacProvider) {
    throw new ConfigValidationError(
      "DASHBOARD_RBAC_ENABLED=true requires DASHBOARD_RBAC_PROVIDER",
    );
  }

  if (config.prometheusEnabled && !config.prometheusUrl) {
    throw new ConfigValidationError(
      "PROMETHEUS_ENABLED=true requires PROMETHEUS_URL",
    );
  }

  if (config.alertWebhookEnabled && !config.alertWebhookUrl) {
    throw new ConfigValidationError(
      "ALERT_WEBHOOK_ENABLED=true requires ALERT_WEBHOOK_URL",
    );
  }
}

// ---------------------------------------------------------------------------
// Loading from resolved JSON (written by CLI)
// ---------------------------------------------------------------------------

/**
 * Load dashboard config from a resolved JSON file.
 * Returns a partial config — must be merged with defaults.
 */
function loadFromResolvedJson(path: string): Partial<DashboardConfig> {
  if (!existsSync(path)) {
    throw new Error(`Resolved dashboard config not found: ${path}`);
  }

  const raw = readFileSync(path, "utf-8");
  const json = JSON.parse(raw) as ResolvedDashboardJson;

  if (json._version !== 1) {
    throw new Error(
      `Unsupported resolved config version: ${json._version}. Expected 1.`,
    );
  }

  const result: Partial<DashboardConfig> = {};

  if (json.flinkRestUrl) result.flinkRestUrl = json.flinkRestUrl;
  if (json.dashboardPort != null) result.dashboardPort = json.dashboardPort;
  if (json.authType) result.authType = parseAuthType(json.authType);
  if (json.authUsername) result.authUsername = json.authUsername;
  if (json.authPassword) result.authPassword = json.authPassword;
  if (json.authToken) result.authToken = json.authToken;
  if (json.sslEnabled != null) result.sslEnabled = json.sslEnabled;
  if (json.sslCaPath) result.sslCaPath = json.sslCaPath;
  if (json.pollIntervalMs != null) result.pollIntervalMs = json.pollIntervalMs;
  if (json.logBufferSize != null) result.logBufferSize = json.logBufferSize;
  if (json.clusterDisplayName) result.clusterDisplayName = json.clusterDisplayName;
  if (json.mockMode != null) result.mockMode = json.mockMode;
  if (json.rbacEnabled != null) result.rbacEnabled = json.rbacEnabled;
  if (json.rbacProvider) result.rbacProvider = parseRbacProvider(json.rbacProvider);
  if (json.rbacRoles) result.rbacRoles = json.rbacRoles;
  if (json.prometheusUrl) result.prometheusUrl = json.prometheusUrl;
  if (json.prometheusEnabled != null) result.prometheusEnabled = json.prometheusEnabled;
  if (json.alertWebhookUrl) result.alertWebhookUrl = json.alertWebhookUrl;
  if (json.alertWebhookEnabled != null) result.alertWebhookEnabled = json.alertWebhookEnabled;

  return result;
}

// ---------------------------------------------------------------------------
// Loading from environment variables (existing behavior)
// ---------------------------------------------------------------------------

function loadFromEnvVars(): DashboardConfig {
  const env = process.env;
  const flinkRestUrl = env.FLINK_REST_URL || null;

  return {
    flinkRestUrl,
    dashboardPort: parseInt(env.DASHBOARD_PORT, 3001),

    authType: parseAuthType(env.FLINK_AUTH_TYPE),
    authUsername: env.FLINK_AUTH_USERNAME || undefined,
    authPassword: env.FLINK_AUTH_PASSWORD || undefined,
    authToken: env.FLINK_AUTH_TOKEN || undefined,

    sslEnabled: parseBool(env.FLINK_SSL_ENABLED, false),
    sslCaPath: env.FLINK_SSL_CA_PATH || undefined,

    pollIntervalMs: parseInt(env.DASHBOARD_POLL_INTERVAL, 5000),
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
  };
}

// ---------------------------------------------------------------------------
// Main loader (cached singleton)
//
// Merge priority: Explicit env var > Resolved JSON > Built-in default
// ---------------------------------------------------------------------------

let cached: DashboardConfig | null = null;

export function getConfig(): DashboardConfig {
  if (cached) return cached;

  // Start with env-var-based config (includes built-in defaults)
  const envConfig = loadFromEnvVars();
  let config = envConfig;

  // If FLINK_REACTOR_CONFIG points to a JSON file, merge it in
  const resolvedJsonPath = process.env.FLINK_REACTOR_CONFIG;
  if (resolvedJsonPath) {
    const jsonConfig = loadFromResolvedJson(resolvedJsonPath);

    // Merge: JSON values are the base, env vars override when explicitly set
    config = {
      ...envConfig,
      // Use JSON values as defaults — env vars override only when explicitly set
      flinkRestUrl: process.env.FLINK_REST_URL ? envConfig.flinkRestUrl : (jsonConfig.flinkRestUrl ?? envConfig.flinkRestUrl),
      dashboardPort: process.env.DASHBOARD_PORT ? envConfig.dashboardPort : (jsonConfig.dashboardPort ?? envConfig.dashboardPort),

      authType: process.env.FLINK_AUTH_TYPE ? envConfig.authType : (jsonConfig.authType ?? envConfig.authType),
      authUsername: process.env.FLINK_AUTH_USERNAME ? envConfig.authUsername : (jsonConfig.authUsername ?? envConfig.authUsername),
      authPassword: process.env.FLINK_AUTH_PASSWORD ? envConfig.authPassword : (jsonConfig.authPassword ?? envConfig.authPassword),
      authToken: process.env.FLINK_AUTH_TOKEN ? envConfig.authToken : (jsonConfig.authToken ?? envConfig.authToken),

      sslEnabled: process.env.FLINK_SSL_ENABLED ? envConfig.sslEnabled : (jsonConfig.sslEnabled ?? envConfig.sslEnabled),
      sslCaPath: process.env.FLINK_SSL_CA_PATH ? envConfig.sslCaPath : (jsonConfig.sslCaPath ?? envConfig.sslCaPath),

      pollIntervalMs: process.env.DASHBOARD_POLL_INTERVAL ? envConfig.pollIntervalMs : (jsonConfig.pollIntervalMs ?? envConfig.pollIntervalMs),
      logBufferSize: process.env.DASHBOARD_LOG_BUFFER_SIZE ? envConfig.logBufferSize : (jsonConfig.logBufferSize ?? envConfig.logBufferSize),

      clusterDisplayName: process.env.CLUSTER_DISPLAY_NAME ? envConfig.clusterDisplayName : (jsonConfig.clusterDisplayName ?? envConfig.clusterDisplayName),
      clusters: process.env.FLINK_CLUSTERS ? envConfig.clusters : envConfig.clusters,

      rbacEnabled: process.env.DASHBOARD_RBAC_ENABLED ? envConfig.rbacEnabled : (jsonConfig.rbacEnabled ?? envConfig.rbacEnabled),
      rbacProvider: process.env.DASHBOARD_RBAC_PROVIDER ? envConfig.rbacProvider : (jsonConfig.rbacProvider ?? envConfig.rbacProvider),
      rbacRoles: process.env.DASHBOARD_RBAC_ROLES ? envConfig.rbacRoles : (jsonConfig.rbacRoles ?? envConfig.rbacRoles),

      prometheusUrl: process.env.PROMETHEUS_URL ? envConfig.prometheusUrl : (jsonConfig.prometheusUrl ?? envConfig.prometheusUrl),
      prometheusEnabled: process.env.PROMETHEUS_ENABLED ? envConfig.prometheusEnabled : (jsonConfig.prometheusEnabled ?? envConfig.prometheusEnabled),

      alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ? envConfig.alertWebhookUrl : (jsonConfig.alertWebhookUrl ?? envConfig.alertWebhookUrl),
      alertWebhookEnabled: process.env.ALERT_WEBHOOK_ENABLED ? envConfig.alertWebhookEnabled : (jsonConfig.alertWebhookEnabled ?? envConfig.alertWebhookEnabled),

      mockMode: process.env.DASHBOARD_MOCK_MODE ? envConfig.mockMode : (jsonConfig.mockMode ?? envConfig.mockMode),
    };
  }

  validate(config);
  cached = config;
  return config;
}

/**
 * Extract browser-safe subset of the config.
 */
export function getPublicConfig(): PublicDashboardConfig {
  const config = getConfig();
  return {
    pollIntervalMs: config.pollIntervalMs,
    logBufferSize: config.logBufferSize,
    clusterDisplayName: config.clusterDisplayName,
    mockMode: config.mockMode,
    clusters: config.clusters.map((c) => c.name),
    rbacEnabled: config.rbacEnabled,
    prometheusEnabled: config.prometheusEnabled,
    alertWebhookEnabled: config.alertWebhookEnabled,
  };
}

/**
 * Reset cached config — used by CLI when switching environments.
 */
export function resetConfig(): void {
  cached = null;
}
