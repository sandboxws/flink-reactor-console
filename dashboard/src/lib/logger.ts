import { Logger } from "tslog"

// ---------------------------------------------------------------------------
// Dashboard structured logging — tslog root + sub-logger factories
// ---------------------------------------------------------------------------

/** Valid log level names that map to tslog numeric levels. */
const LOG_LEVEL_MAP: Record<string, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
}

/** Resolve the minimum log level from an optional string override. */
function resolveMinLevel(
  override: string | undefined | null,
  isDev: boolean,
): number {
  if (override && override in LOG_LEVEL_MAP) {
    return LOG_LEVEL_MAP[override]
  }
  return isDev ? 2 /* debug */ : 4 /* warn */
}

// ---------------------------------------------------------------------------
// Server logger — Node.js API routes
// ---------------------------------------------------------------------------

let serverInstance: Logger<unknown> | null = null

/**
 * Get the server-side tslog Logger instance.
 * Cached singleton — safe to call from every API route.
 */
export function createServerLogger(): Logger<unknown> {
  if (serverInstance) return serverInstance

  const isDev = process.env.NODE_ENV !== "production"
  const minLevel = resolveMinLevel(process.env.DASHBOARD_LOG_LEVEL, isDev)

  serverInstance = new Logger({
    name: "dashboard",
    type: isDev ? "pretty" : "json",
    minLevel,
  })

  return serverInstance
}

// ---------------------------------------------------------------------------
// Client logger — browser stores/components
// ---------------------------------------------------------------------------

let clientInstance: Logger<unknown> | null = null

/**
 * Get the browser-side tslog Logger instance.
 * Does NOT access `process.env` — reads log level from the config store.
 *
 * @param logLevel - Optional log level override from the config store.
 */
export function createClientLogger(logLevel?: string | null): Logger<unknown> {
  if (clientInstance) return clientInstance

  // In the browser, we detect dev vs prod by checking if we're in a dev build.
  // Next.js sets this at build time and it's safe to read from the bundle.
  const isDev =
    typeof window !== "undefined" && window.location.hostname === "localhost"

  const minLevel = resolveMinLevel(logLevel, isDev)

  clientInstance = new Logger({
    name: "dashboard",
    type: isDev ? "pretty" : "json",
    minLevel,
  })

  return clientInstance
}
