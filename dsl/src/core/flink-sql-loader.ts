// ── FlinkSQL parser loader ───────────────────────────────────────────
// dt-sql-parser's published dist is bundler-only (ESM syntax in a
// CJS-typed package, extensionless directory imports) — plain Node ESM
// cannot load it. Packaged builds therefore reach the parser through a
// pre-bundled vendor chunk behind the self-referencing subpath
// `@flink-reactor/dsl/vendor-dt-sql-parser` (see tsup.config.ts); when
// that subpath is unavailable — running from source under vitest, or
// inside the browser bundle, where bundler resolution handles the bare
// package fine — the loader falls back to importing dt-sql-parser
// directly.

// Non-literal so neither TypeScript nor any bundler tries to resolve the
// self-referencing subpath at build time — it only exists in the
// published artifact; everywhere else the catch-and-fallback handles it.
const VENDOR_SUBPATH = "@flink-reactor/dsl/vendor-dt-sql-parser"

/** Minimal surface of dt-sql-parser's FlinkSQL class that callers use. */
export interface FlinkSQLParserLike {
  validate(sql: string): Array<{
    startIndex: number
    endIndex: number
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
    message: string
  }>
}

type FlinkSQLConstructor = new () => FlinkSQLParserLike

function pickFlinkSQL(mod: unknown): FlinkSQLConstructor | undefined {
  const bag = mod as Record<string, unknown>
  // CJS-interop shape: the class may sit behind `default`.
  return (bag.FlinkSQL ??
    (bag.default as Record<string, unknown> | undefined)?.FlinkSQL) as
    | FlinkSQLConstructor
    | undefined
}

let cachedCtor: FlinkSQLConstructor | null = null

/**
 * Resolve the FlinkSQL parser constructor, preferring the packaged
 * vendor chunk. Throws only when BOTH paths fail — callers decide
 * whether that degrades gracefully (LSP, deep verify) or surfaces
 * (expression validation).
 */
export async function loadFlinkSQL(): Promise<FlinkSQLConstructor> {
  if (cachedCtor) return cachedCtor

  let lastError: unknown
  try {
    const vendored: unknown = await import(VENDOR_SUBPATH)
    const ctor = pickFlinkSQL(vendored)
    if (ctor) {
      cachedCtor = ctor
      return ctor
    }
  } catch (err) {
    lastError = err
  }

  try {
    const direct = await import("dt-sql-parser")
    const ctor = pickFlinkSQL(direct)
    if (ctor) {
      cachedCtor = ctor
      return ctor
    }
  } catch (err) {
    lastError = err
  }

  throw new Error(
    `Failed to load FlinkSQL from dt-sql-parser (vendor chunk and direct import both failed): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}
