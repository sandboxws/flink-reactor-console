// ── Sandbox Synthesizer ─────────────────────────────────────────────
// Browser-side TSX → SQL compilation pipeline.
// Sucrase transpilation → new Function() execution → synthesizeApp()
//
// The DSL browser bundle is lazy-loaded on first synthesis to avoid
// slowing down the initial dashboard load (~1-2MB).

import { transform } from "sucrase"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineOutput {
  name: string
  sql: string
  crdYaml: string
}

interface SynthesisSuccess {
  ok: true
  pipelines: PipelineOutput[]
  diagnostics: Array<{
    severity: "error" | "warning"
    message: string
    componentName?: string
  }>
  timeMs: number
}

interface SynthesisError {
  ok: false
  error: string
  errorKind: "transpile" | "synthesis" | "unexpected"
  line?: number
  column?: number
}

export type SynthesisResult = SynthesisSuccess | SynthesisError

// ---------------------------------------------------------------------------
// Lazy-loaded DSL module cache
// ---------------------------------------------------------------------------

type DslModule = typeof import("flink-reactor/browser")

let cachedDsl: DslModule | null = null
let loadingPromise: Promise<DslModule> | null = null

export function isDslLoaded(): boolean {
  return cachedDsl !== null
}

async function loadDsl(): Promise<DslModule> {
  if (cachedDsl) return cachedDsl
  if (loadingPromise) return loadingPromise

  loadingPromise = import("flink-reactor/browser").then((mod) => {
    cachedDsl = mod
    loadingPromise = null
    return mod
  })

  return loadingPromise
}

// ---------------------------------------------------------------------------
// Transpile TSX → JS via Sucrase
// ---------------------------------------------------------------------------

function transpile(code: string): string {
  const result = transform(code, {
    transforms: ["typescript", "jsx"],
    jsxPragma: "createElement",
    jsxFragmentPragma: "Fragment",
  })
  return result.code
}

// ---------------------------------------------------------------------------
// Execute transpiled JS with DSL scope injection
// ---------------------------------------------------------------------------

function execute(
  jsCode: string,
  dsl: DslModule,
): import("flink-reactor/browser").ConstructNode {
  // Inject all DSL exports as scope parameters so the user doesn't
  // need import statements. `import * as DSL` captures everything,
  // including any newly added components.
  const paramNames = Object.keys(dsl)
  const paramValues = paramNames.map(
    (k) => (dsl as Record<string, unknown>)[k],
  )

  // Wrap in an IIFE that returns the last expression.
  // Users write bare JSX like `<Pipeline>...</Pipeline>` — we need
  // to capture the return value.
  const wrappedCode = `"use strict";\nreturn (\n${jsCode}\n);`

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...paramNames, wrappedCode)
  return fn(...paramValues)
}

// ---------------------------------------------------------------------------
// Main synthesis entry point
// ---------------------------------------------------------------------------

export async function synthesize(code: string): Promise<SynthesisResult> {
  const start = performance.now()

  try {
    // 1. Lazy-load the DSL bundle
    const dsl = await loadDsl()

    // 2. Transpile TSX → JS
    let jsCode: string
    try {
      jsCode = transpile(code)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Sucrase errors include line/column info in the message
      const lineMatch = msg.match(/\((\d+):(\d+)\)/)
      return {
        ok: false,
        error: msg,
        errorKind: "transpile",
        line: lineMatch ? Number(lineMatch[1]) : undefined,
        column: lineMatch ? Number(lineMatch[2]) : undefined,
      }
    }

    // 3. Execute transpiled code with DSL scope
    const resultNode = execute(jsCode, dsl)

    // 4. Synthesize the construct tree
    const result = dsl.synthesizeApp({
      name: "sandbox",
      children: [resultNode],
    })

    // 5. Serialize outputs and collect diagnostics
    const pipelines: PipelineOutput[] = result.pipelines.map((p) => ({
      name: p.name,
      sql: p.sql.sql,
      crdYaml: dsl.toYaml(p.crd),
    }))

    const diagnostics = result.pipelines.flatMap((p) =>
      p.sql.diagnostics.map((d) => ({
        severity: d.severity,
        message: d.message,
        componentName: d.componentName,
      })),
    )

    const timeMs = Math.round(performance.now() - start)

    return { ok: true, pipelines, diagnostics, timeMs }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    // Distinguish DSL validation errors from unexpected errors
    const isDslError =
      err instanceof Error &&
      ("_tag" in err || msg.includes("Validation") || msg.includes("Pipeline"))

    return {
      ok: false,
      error: msg,
      errorKind: isDslError ? "synthesis" : "unexpected",
    }
  }
}
