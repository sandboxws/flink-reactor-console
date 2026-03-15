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

export interface ValidationDiagnostic {
  severity: "error" | "warning"
  message: string
  componentName?: string
  nodeId?: string
  category?: "schema" | "expression" | "connector" | "changelog" | "structure" | "sql"
  details?: {
    readonly availableColumns?: readonly string[]
    readonly referencedColumn?: string
    readonly expressionErrors?: readonly string[]
    readonly missingProps?: readonly string[]
  }
}

export interface PipelineOutput {
  name: string
  sql: string
  crdYaml: string
}

interface SynthesisSuccess {
  ok: true
  pipelines: PipelineOutput[]
  diagnostics: ValidationDiagnostic[]
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
  // Bare JSX at statement position (`<Pipeline>...`) is invalid JS —
  // Sucrase sees `<` as less-than. Find the last top-level JSX tag
  // that starts at column 0 (not indented/nested in parens) and wrap
  // it in parentheses to put it in expression position.
  let prepared = code
  const bareJsxPattern = /^(<[A-Z])/m
  const match = prepared.match(bareJsxPattern)
  if (match?.index != null) {
    prepared =
      prepared.slice(0, match.index) +
      "(" +
      prepared.slice(match.index) +
      "\n)"
  }

  const result = transform(prepared, {
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

  // The transpiled code has statements (const schema = ...) followed
  // by a parenthesized createElement() expression (from the JSX we
  // wrapped in parens before transpilation). Insert `return` before
  // the last top-level expression so the function returns the tree.
  let lastIdx = jsCode.lastIndexOf("\n(createElement(")
  if (lastIdx < 0) lastIdx = jsCode.lastIndexOf("\ncreateElement(")

  let wrappedCode: string
  if (lastIdx >= 0) {
    wrappedCode = `"use strict";\n${jsCode.slice(0, lastIdx + 1)}return ${jsCode.slice(lastIdx + 1)}`
  } else if (
    jsCode.trimStart().startsWith("createElement(") ||
    jsCode.trimStart().startsWith("(createElement(")
  ) {
    wrappedCode = `"use strict";\nreturn ${jsCode}`
  } else {
    wrappedCode = `"use strict";\nreturn (\n${jsCode}\n);`
  }

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

    // 5. Serialize outputs
    const pipelines: PipelineOutput[] = result.pipelines.map((p) => ({
      name: p.name,
      sql: p.sql.sql,
      crdYaml: dsl.toYaml(p.crd),
    }))

    // 6. Run full validation pipeline
    const diagnostics: ValidationDiagnostic[] = []

    // Collect SQL-generation diagnostics
    for (const p of result.pipelines) {
      for (const d of p.sql.diagnostics) {
        diagnostics.push({
          severity: d.severity,
          message: d.message,
          componentName: d.component,
          nodeId: d.nodeId,
          category: d.category,
          details: d.details,
        })
      }
    }

    // Run SynthContext-based validation (schema, connector, changelog, structure)
    for (const p of result.pipelines) {
      const pipelineNode = resultNode.children?.find(
        (c: import("flink-reactor/browser").ConstructNode) =>
          c.kind === "Pipeline" && c.props.name === p.name,
      ) ?? resultNode

      const ctx = new dsl.SynthContext()
      ctx.buildFromTree(pipelineNode)
      // Exclude "structure" category — structural validators (orphan sources,
      // dangling sinks) assume explicit DAG edges, but JSX sibling nesting
      // uses implicit linear ordering that the graph doesn't capture.
      const syncDiags = ctx.validate(pipelineNode, undefined, {
        categories: ["schema", "connector", "changelog"],
      })
      for (const d of syncDiags) {
        diagnostics.push({
          severity: d.severity,
          message: d.message,
          nodeId: d.nodeId,
          category: d.category,
          componentName: d.component,
          details: d.details,
        })
      }

      // Expression syntax validation (async, conditional on no schema errors)
      const hasSchemaErrors = diagnostics.some(
        (d) => d.category === "schema" && d.severity === "error",
      )
      if (!hasSchemaErrors) {
        try {
          const exprDiags = await dsl.validateExpressionSyntax(pipelineNode)
          for (const d of exprDiags) {
            diagnostics.push({
              severity: d.severity,
              message: d.message,
              nodeId: d.nodeId,
              category: d.category,
              componentName: d.component,
              details: d.details,
            })
          }
        } catch {
          // Expression validation depends on dt-sql-parser — skip on failure
        }
      }

      // Post-generation SQL verification
      const sqlStatements = p.sql.sql
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean)
      const sqlDiags = dsl.verifySql(sqlStatements)
      for (const d of sqlDiags) {
        diagnostics.push({
          severity: d.severity,
          message: d.message,
          category: "sql",
        })
      }
    }

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
