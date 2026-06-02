import type { FlinkMajorVersion } from "@flink-reactor/dsl/browser"

/** Server configuration, sourced from `flinkReactor.*` client settings. */
export interface ServerConfig {
  /** Debounce window (ms) after the last edit before re-synthesizing. */
  readonly debounceMs: number
  /** Per-synthesis isolation timeout (ms). */
  readonly timeoutMs: number
  /** Worker heap ceiling (MB). */
  readonly maxOldGenerationSizeMb: number
  /** Master enable switch; when false the server publishes no diagnostics. */
  readonly enabled: boolean
  /** Target Flink version override; the DSL default applies when unset. */
  readonly flinkVersion?: FlinkMajorVersion
}

export const DEFAULT_CONFIG: ServerConfig = {
  debounceMs: 300,
  timeoutMs: 5000,
  maxOldGenerationSizeMb: 512,
  enabled: true,
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

/**
 * Parse a `flinkReactor.*` settings object (as forwarded by the client via
 * `initializationOptions` or `workspace/didChangeConfiguration`) into a
 * `ServerConfig`, layering over `base`. Accepts either the namespaced wrapper
 * (`{ flinkReactor: {...} }`) or the inner settings object directly.
 */
export function parseConfig(
  raw: unknown,
  base: ServerConfig = DEFAULT_CONFIG,
): ServerConfig {
  if (!raw || typeof raw !== "object") return base
  const obj = raw as Record<string, unknown>
  const fr = (
    "flinkReactor" in obj &&
    obj.flinkReactor &&
    typeof obj.flinkReactor === "object"
      ? obj.flinkReactor
      : obj
  ) as Record<string, unknown>

  const flinkVersion =
    typeof fr.flinkVersion === "string"
      ? (fr.flinkVersion as FlinkMajorVersion)
      : base.flinkVersion

  return {
    debounceMs: num(fr.debounce ?? fr.debounceMs, base.debounceMs),
    timeoutMs: num(fr.timeout ?? fr.timeoutMs, base.timeoutMs),
    maxOldGenerationSizeMb: num(
      fr.maxHeapMb ?? fr.maxOldGenerationSizeMb,
      base.maxOldGenerationSizeMb,
    ),
    enabled: bool(fr.enable ?? fr.enabled, base.enabled),
    flinkVersion,
  }
}
