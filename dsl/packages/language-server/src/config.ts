import type { FlinkMajorVersion } from "@flink-reactor/dsl/browser"

/**
 * Embedded-SQL highlighting mode (`flinkReactor.sql.highlighting`). Controls
 * which of the two coloring layers are active; the server only acts on whether
 * the *semantic* layer is on (the TextMate layer is a client-side grammar
 * contribution). `semantic` and `semantic+textmate` enable server SQL tokens.
 */
export type SqlHighlightingMode =
  | "semantic+textmate"
  | "textmate"
  | "semantic"
  | "off"

const SQL_HIGHLIGHTING_MODES: readonly SqlHighlightingMode[] = [
  "semantic+textmate",
  "textmate",
  "semantic",
  "off",
]

/** How the schema fact of an inlay hint renders (`flinkReactor.inlayHints.schema`):
 *  `count` shows `N cols`, `compact` an inline column-name list (width-bounded,
 *  falling back to a count), `off` omits the schema fact entirely. */
export type InlayHintSchemaMode = "off" | "count" | "compact"

const INLAY_HINT_SCHEMA_MODES: readonly InlayHintSchemaMode[] = [
  "off",
  "count",
  "compact",
]

/** Per-hint-kind toggles for the synthesis-backed inlay hints
 *  (`flinkReactor.inlayHints.*`, forwarded by the client). `enabled` is the
 *  master switch — off returns no hints regardless of the individual parts. */
export interface InlayHintsConfig {
  readonly enabled: boolean
  readonly schema: InlayHintSchemaMode
  readonly changelogMode: boolean
  readonly parallelism: boolean
  readonly windowColumns: boolean
  readonly joinColumns: boolean
}

export const DEFAULT_INLAY_HINTS: InlayHintsConfig = {
  enabled: true,
  schema: "count",
  changelogMode: true,
  parallelism: true,
  windowColumns: true,
  joinColumns: true,
}

/** Server configuration, sourced from `flinkReactor.*` client settings. */
export interface ServerConfig {
  /** Debounce window (ms) after the last edit before re-synthesizing. */
  readonly debounceMs: number
  /** Per-synthesis isolation timeout (ms) for a warm worker. */
  readonly timeoutMs: number
  /** Budget (ms) for the FIRST synthesis on a freshly-spawned worker, which
   *  also pays worker-thread boot + the first project-DSL import. Generous so a
   *  cold start (e.g. right after install) doesn't trip `timeoutMs`. */
  readonly bootGraceMs: number
  /** Worker heap ceiling (MB). */
  readonly maxOldGenerationSizeMb: number
  /** Master enable switch; when false the server publishes no diagnostics. */
  readonly enabled: boolean
  /** Target Flink version override; the DSL default applies when unset. */
  readonly flinkVersion?: FlinkMajorVersion
  /**
   * Set by the client (via `initializationOptions`) when the
   * `@flink-reactor/ts-plugin` is active for the workspace. When true the
   * server suppresses child-component completions — the plugin owns those
   * in-`tsserver` — and serves only props, enums, and Flink types. The VS Code
   * shell sets this; IntelliJ/Neovim without the plugin leave it false so the
   * server serves all four completion kinds standalone.
   */
  readonly tsPluginActive: boolean
  /** Embedded-SQL highlighting mode. The server emits SQL semantic tokens only
   *  for `semantic`/`semantic+textmate`; `textmate`/`off` suppress them. */
  readonly sqlHighlighting: SqlHighlightingMode
  /** Synthesis-backed inlay-hint toggles (`flinkReactor.inlayHints.*`). */
  readonly inlayHints: InlayHintsConfig
}

export const DEFAULT_CONFIG: ServerConfig = {
  debounceMs: 300,
  timeoutMs: 8000,
  bootGraceMs: 20000,
  maxOldGenerationSizeMb: 512,
  enabled: true,
  tsPluginActive: false,
  sqlHighlighting: "semantic+textmate",
  inlayHints: DEFAULT_INLAY_HINTS,
}

/** Does this mode have the server contribute SQL semantic tokens? */
export function sqlSemanticTokensEnabled(config: ServerConfig): boolean {
  return (
    config.sqlHighlighting === "semantic" ||
    config.sqlHighlighting === "semantic+textmate"
  )
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
    sqlHighlighting: parseSqlHighlighting(fr, base.sqlHighlighting),
    inlayHints: parseInlayHints(fr, base.inlayHints),
    debounceMs: num(fr.debounce ?? fr.debounceMs, base.debounceMs),
    timeoutMs: num(fr.timeout ?? fr.timeoutMs, base.timeoutMs),
    bootGraceMs: num(fr.bootGraceMs, base.bootGraceMs),
    maxOldGenerationSizeMb: num(
      fr.maxHeapMb ?? fr.maxOldGenerationSizeMb,
      base.maxOldGenerationSizeMb,
    ),
    enabled: bool(fr.enable ?? fr.enabled, base.enabled),
    flinkVersion,
    // Accept the flag whether namespaced under `flinkReactor` or sent at the
    // top level of `initializationOptions`.
    tsPluginActive: bool(
      fr.tsPluginActive ?? obj.tsPluginActive,
      base.tsPluginActive,
    ),
  }
}

/**
 * Read the `flinkReactor.inlayHints.*` toggles from the forwarded settings —
 * a nested `inlayHints` object (`{ enabled, schema, changelogMode, … }`).
 * Unknown/absent keys fall back per-key so a partial settings payload (or an
 * older client) degrades to the current values rather than resetting them.
 */
function parseInlayHints(
  fr: Record<string, unknown>,
  base: InlayHintsConfig,
): InlayHintsConfig {
  const raw =
    fr.inlayHints && typeof fr.inlayHints === "object"
      ? (fr.inlayHints as Record<string, unknown>)
      : {}
  const schema = INLAY_HINT_SCHEMA_MODES.includes(
    raw.schema as InlayHintSchemaMode,
  )
    ? (raw.schema as InlayHintSchemaMode)
    : base.schema
  return {
    enabled: bool(raw.enabled, base.enabled),
    schema,
    changelogMode: bool(raw.changelogMode, base.changelogMode),
    parallelism: bool(raw.parallelism, base.parallelism),
    windowColumns: bool(raw.windowColumns, base.windowColumns),
    joinColumns: bool(raw.joinColumns, base.joinColumns),
  }
}

/**
 * Read the SQL-highlighting mode, accepting either the VS Code shell's flat
 * `sqlHighlighting` key (forwarded by the client) or a nested `sql.highlighting`
 * shape (a raw `flinkReactor` settings object from a non-VS-Code client). An
 * unknown value falls back to the current mode.
 */
function parseSqlHighlighting(
  fr: Record<string, unknown>,
  fallback: SqlHighlightingMode,
): SqlHighlightingMode {
  const nested =
    fr.sql && typeof fr.sql === "object"
      ? (fr.sql as Record<string, unknown>).highlighting
      : undefined
  const value = fr.sqlHighlighting ?? nested
  return SQL_HIGHLIGHTING_MODES.includes(value as SqlHighlightingMode)
    ? (value as SqlHighlightingMode)
    : fallback
}
