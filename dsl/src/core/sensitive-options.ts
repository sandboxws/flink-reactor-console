// ── Sensitive connector-option detection + redaction ────────────────
// Credentials flow into Flink DDL as plain WITH-clause values — that is
// unavoidable (Flink needs literal values at submit time). What is
// avoidable is echoing those values into every *display* surface:
// statement banners, statementMeta hover tooltips, pipeline manifests,
// and the CRD-embedded SQL copy that `kubectl get -o yaml` and the Flink
// REST API expose.
//
// Hard rule: executable artifacts keep raw values (dist/pipeline.sql,
// ConfigMaps, pipeline.yaml, tap observation SQL, gateway EXPLAIN
// submissions). Redaction applies ONLY to display surfaces.
//
// Browser-safe: no Node APIs — the language server imports this via
// `@flink-reactor/dsl/browser`.

/** Replacement value for masked option values. */
export const SENSITIVE_VALUE_MASK = "******"

/**
 * Key segments that mark an option as credential-bearing. A key is split
 * into segments on `.`/`-`/`_` and camelCase boundaries, then matched
 * segment-wise — so `properties.sasl.jaas.config`, `ssl.keystore-password`
 * and `saslPassword` all match, while `key.format`, `keyFields` and
 * `scan.startup.mode` do not.
 *
 * `keystore`/`truststore` deliberately over-match (`keystore.type` is not
 * a secret): the cost of masking a non-secret display value is near zero;
 * the cost of leaking a keystore passphrase is not.
 */
const SENSITIVE_SEGMENTS: ReadonlySet<string> = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "credential",
  "credentials",
  "jaas",
  "keystore",
  "truststore",
  "bearer",
  "apikey",
  "sslpassword",
])

/** Normalized-suffix matches for multi-segment credential keys. */
const SENSITIVE_SUFFIXES: readonly string[] = [
  "access-key",
  "api-key",
  "private-key",
]

function segmentize(key: string): string[] {
  return key
    .split(/[._-]/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 0)
}

/** True when `key` names a credential-bearing connector option. */
export function isSensitiveOptionKey(key: string): boolean {
  const segments = segmentize(key)
  if (segments.some((segment) => SENSITIVE_SEGMENTS.has(segment))) {
    return true
  }
  const normalized = segments.join("-")
  return SENSITIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

/**
 * Mask credential query parameters embedded in connection URLs
 * (`jdbc:postgresql://…?user=app&password=hunter2`). Handles `&`, `?`
 * and `;` separators (MySQL/PostgreSQL/SQL Server styles). Idempotent.
 */
export function redactUrlCredentials(value: string): string {
  return value.replace(
    /([?&;](?:password|sslpassword|trustStorePassword|keyStorePassword)=)[^&;'"\s]*/gi,
    `$1${SENSITIVE_VALUE_MASK}`,
  )
}

/**
 * Return a copy of a connector-options record with sensitive values
 * masked and URL-embedded credentials scrubbed from the rest. For
 * display surfaces only — never feed the result into DDL emission.
 */
export function redactOptions(
  options: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(options)) {
    out[key] = isSensitiveOptionKey(key)
      ? SENSITIVE_VALUE_MASK
      : redactUrlCredentials(value)
  }
  return out
}

/**
 * Mask sensitive values inside SQL text: `'key' = 'value'` WITH-clause
 * pairs whose key is sensitive, plus credential query params inside any
 * quoted string (JDBC URLs). The SQL stays parseable — only values
 * change. Idempotent; for display copies only.
 */
export function redactSqlText(sql: string): string {
  return sql.replace(
    /'([^']+)'\s*=\s*'([^']*)'/g,
    (_match, key: string, value: string) =>
      isSensitiveOptionKey(key)
        ? `'${key}' = '${SENSITIVE_VALUE_MASK}'`
        : `'${key}' = '${redactUrlCredentials(value)}'`,
  )
}
