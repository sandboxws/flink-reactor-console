import {
  type ConstructNode,
  type SqlFragment,
  type StatementMeta,
  type StatementOrigin,
  synthesizeApp,
  toYaml,
  type ValidationDiagnostic,
  validateConnectorProperties,
  validateExpressionSyntax,
  validateSchemaReferences,
} from "@flink-reactor/dsl/browser"
import {
  collectChangelogDiagnostics,
  collectGraphFacts,
  collectStructuralDiagnostics,
} from "./graph-validation.js"
import { loadPipelineNode } from "./load.js"
import type {
  DecodedContributor,
  DecodedOrigin,
  DecodedStatementMeta,
  LoadError,
  NodeProjection,
  SourceRange,
  SynthesisInput,
  SynthesisResult,
} from "./types.js"

// ── Decoders: DSL `Map`-typed source maps → serializable arrays ──────

function decodeOrigins(
  m: ReadonlyMap<number, StatementOrigin>,
): DecodedOrigin[] {
  return [...m.entries()]
    .map(([statementIndex, o]) => ({
      statementIndex,
      nodeId: o.nodeId,
      component: o.component,
      kind: o.kind,
    }))
    .sort((a, b) => a.statementIndex - b.statementIndex)
}

function decodeContributors(
  m: ReadonlyMap<number, readonly SqlFragment[]>,
): DecodedContributor[] {
  return [...m.entries()]
    .map(([statementIndex, frags]) => ({
      statementIndex,
      fragments: frags.map((f) => ({
        offset: f.offset,
        length: f.length,
        nodeId: f.origin.nodeId,
        component: f.origin.component,
        kind: f.origin.kind,
      })),
    }))
    .sort((a, b) => a.statementIndex - b.statementIndex)
}

function decodeMeta(
  m: ReadonlyMap<number, StatementMeta>,
): DecodedStatementMeta[] {
  return [...m.entries()]
    .map(([statementIndex, meta]) => ({ statementIndex, meta }))
    .sort((a, b) => a.statementIndex - b.statementIndex)
}

/** Project the construct tree (pre-order) into the serializable node list the
 *  source mapper consumes for node count + any `__loc` fast-path. */
function projectNodes(root: ConstructNode): NodeProjection[] {
  const out: NodeProjection[] = []
  const walk = (n: ConstructNode): void => {
    const loc = (n as { __loc?: SourceRange }).__loc
    out.push({ id: n.id, component: n.component, kind: n.kind, loc })
    for (const c of n.children) walk(c)
  }
  walk(root)
  return out
}

// ── Validation pass (non-throwing) ──────────────────────────────────

/**
 * Collect FlinkReactor validation findings without throwing, across all five
 * categories the `validation-diagnostics` capability surfaces:
 *   - `schema` — `validateSchemaReferences`
 *   - `connector` — `validateConnectorProperties` (standalone)
 *   - `structure` — chain-aware orphan/dangling/cycle detection
 *   - `changelog` — changelog-mode propagation over a dataflow graph
 *   - `expression` — `validateExpressionSyntax`
 *
 * Structural and changelog findings use the chain-aware helpers in
 * `graph-validation.ts` (built on the DSL's `resolveSiblingChains`), not the
 * naive `SynthContext.buildFromTree`, which mis-models the sibling-chain
 * topology (it would flag every source under a `<Pipeline>` as an orphan).
 */
async function collectDiagnostics(
  node: ConstructNode,
): Promise<ValidationDiagnostic[]> {
  const schema = validateSchemaReferences(node)
  const connector = validateConnectorProperties(node, { standalone: true })
  const structural = collectStructuralDiagnostics(node)
  const changelog = collectChangelogDiagnostics(node)

  let expr: ValidationDiagnostic[] = []
  try {
    expr = await validateExpressionSyntax(node)
  } catch {
    // The SQL parser failed to load — skip expression validation rather than
    // failing the whole pass.
  }
  return [...schema, ...connector, ...structural, ...changelog, ...expr]
}

function emptyResult(
  loadError: LoadError,
  nodes: readonly NodeProjection[] = [],
  diagnostics: readonly ValidationDiagnostic[] = [],
): SynthesisResult {
  return {
    ok: false,
    statements: [],
    sql: "",
    diagnostics,
    statementOrigins: [],
    statementContributors: [],
    statementMeta: [],
    edges: [],
    changelogModes: [],
    sinkChangelogAccepts: [],
    nodeInputSchemas: [],
    pipelineManifest: null,
    crdYaml: "",
    nodes,
    loadError,
  }
}

/**
 * Pure synthesis of a single pipeline document (no isolation). The loader
 * resets the node-id counter in the pipeline's own module realm so IDs are
 * deterministic, loads the entry into a ConstructNode, validates it, then runs
 * `synthesizeApp` + `toYaml` and decodes the result. Never throws: any failure
 * is returned as a `loadError`-bearing result.
 *
 * This is the function the worker calls; tests call it directly to exercise
 * synthesis without the worker round-trip.
 */
export async function synthesizeDocument(
  input: SynthesisInput,
): Promise<SynthesisResult> {
  const loaded = await loadPipelineNode({
    entryPoint: input.entryPoint,
    projectDir: input.projectDir,
    documentText: input.documentText,
  })
  if (!loaded.ok) return emptyResult(loaded.error)

  const node = loaded.node
  const nodes = projectNodes(node)

  if (node.kind !== "Pipeline") {
    return emptyResult(
      {
        kind: "no-pipeline",
        message: `Default export is a <${node.component}> (kind ${node.kind}), not a <Pipeline>.`,
      },
      nodes,
    )
  }

  const diagnostics = await collectDiagnostics(node)

  try {
    const app = synthesizeApp(
      {
        name: (node.props.name as string | undefined) ?? "app",
        children: [node],
      },
      input.flinkVersion ? { flinkVersion: input.flinkVersion } : undefined,
    )

    const pipeline = app.pipelines[0]
    if (!pipeline) {
      return emptyResult(
        {
          kind: "no-pipeline",
          message: "No <Pipeline> was synthesized from the default export.",
        },
        nodes,
        diagnostics,
      )
    }

    const sql = pipeline.sql
    const graphFacts = collectGraphFacts(node)
    return {
      ok: true,
      statements: [...sql.statements],
      sql: sql.sql,
      diagnostics,
      statementOrigins: decodeOrigins(sql.statementOrigins),
      statementContributors: decodeContributors(sql.statementContributors),
      statementMeta: decodeMeta(sql.statementMeta),
      edges: graphFacts.edges,
      changelogModes: graphFacts.changelogModes,
      sinkChangelogAccepts: graphFacts.sinkChangelogAccepts,
      nodeInputSchemas: graphFacts.nodeInputSchemas,
      pipelineManifest: pipeline.pipelineManifest,
      crdYaml: toYaml(pipeline.crd),
      nodes,
    }
  } catch (err) {
    return emptyResult(
      {
        kind: "sql",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      nodes,
      diagnostics,
    )
  }
}
