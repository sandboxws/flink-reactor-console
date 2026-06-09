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
  validateSecretHygiene,
} from "@flink-reactor/dsl/browser"
import { buildArtifactSet } from "./artifacts.js"
import {
  collectChangelogDiagnostics,
  collectGraphFacts,
  collectStructuralDiagnostics,
} from "./graph-validation.js"
import { loadPipelineNode } from "./load.js"
import type {
  DecodedContributor,
  DecodedOrigin,
  DecodedParallelism,
  DecodedStatementMeta,
  DecodedTap,
  DecodedTapManifest,
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

/**
 * Decode the pipeline's resolved effective parallelism (the config cascade:
 * Pipeline prop > env override > config > built-in default). The server
 * synthesizes without a project config/environment, so the cascade collapses
 * to *prop > default* here — the level is `prop` exactly when the Pipeline
 * node declares `parallelism`. The value is read from the generated CRD's
 * `job.parallelism` (post-cascade, what the job will actually run with) so it
 * can never drift from the emitted artifact; the prop is the fallback when
 * the CRD shape is unexpected (e.g. a CDC pipeline's ConfigMap-only set).
 */
function decodeParallelism(
  pipelineNode: ConstructNode,
  crd: unknown,
): DecodedParallelism {
  const prop =
    typeof pipelineNode.props.parallelism === "number"
      ? pipelineNode.props.parallelism
      : undefined
  const spec = (crd as { spec?: Record<string, unknown> } | null)?.spec
  // Standard `FlinkDeployment` nests at `spec.job`; `FlinkBlueGreenDeployment`
  // at `spec.template.spec.job`.
  const inner =
    spec && "template" in spec
      ? (spec.template as { spec?: Record<string, unknown> } | undefined)?.spec
      : spec
  const job = inner?.job as { parallelism?: unknown } | undefined
  const fromCrd =
    typeof job?.parallelism === "number" ? job.parallelism : undefined
  return {
    value: fromCrd ?? prop ?? 1,
    level: prop !== undefined ? "prop" : "default",
  }
}

/** The minimal shape of the DSL's `TapManifest` this decoder reads (the full
 *  type is not exported through `@flink-reactor/dsl/browser`'s index types). */
interface TapManifestLike {
  readonly pipelineName: string
  readonly flinkVersion: string
  readonly generatedAt: string
  readonly taps: readonly {
    readonly nodeId: string
    readonly name: string
    readonly componentType: string
    readonly componentName: string
    readonly schema: Record<string, string>
    readonly connectorType: string
    readonly observationSql: string
    readonly consumerGroupId: string
    readonly config: Record<string, unknown>
  }[]
}

/**
 * Decode the pipeline's `TapManifest` for the `tap-visualization` capability:
 * normalize each tap's `schema` record into ordered `{name,type}` columns
 * (Schema declaration order — `Object.entries` preserves it), stamp `autoTap`
 * from the construct tree (a Sink with no `tap` prop is a dev-mode auto-tap —
 * `synthesizeApp` runs tap generation with `devMode: true`), and **drop
 * `connectorProperties`** (it can carry credentials and is not needed to
 * render). `null` passes through — no operators tapped is a valid state.
 */
function decodeTapManifest(
  manifest: TapManifestLike | null | undefined,
  root: ConstructNode,
): DecodedTapManifest | null {
  if (!manifest) return null
  const nodeById = new Map<string, ConstructNode>()
  const index = (n: ConstructNode): void => {
    if (!nodeById.has(n.id)) nodeById.set(n.id, n)
    for (const c of n.children) index(c)
  }
  index(root)

  const taps: DecodedTap[] = manifest.taps.map((tap) => {
    const node = nodeById.get(tap.nodeId)
    const autoTap =
      node !== undefined && node.kind === "Sink" && node.props.tap === undefined
    const config: Record<string, string> = {}
    for (const [key, value] of Object.entries(tap.config)) {
      if (value !== undefined && value !== null) config[key] = String(value)
    }
    return {
      nodeId: tap.nodeId,
      name: tap.name,
      componentType: tap.componentType,
      componentName: tap.componentName,
      connectorType: tap.connectorType,
      consumerGroupId: tap.consumerGroupId,
      schema: Object.entries(tap.schema).map(([name, type]) => ({
        name,
        type,
      })),
      observationSql: tap.observationSql,
      config,
      autoTap,
    }
  })

  return {
    pipelineName: manifest.pipelineName,
    flinkVersion: manifest.flinkVersion,
    generatedAt: manifest.generatedAt,
    taps,
  }
}

/** Project the construct tree (pre-order) into the serializable node list the
 *  source mapper consumes for node count + any `__loc` fast-path. */
function projectNodes(root: ConstructNode): NodeProjection[] {
  const out: NodeProjection[] = []
  const walk = (n: ConstructNode): void => {
    const loc = (n as { __loc?: SourceRange }).__loc
    const name = typeof n.props.name === "string" ? n.props.name : undefined
    out.push({ id: n.id, component: n.component, kind: n.kind, name, loc })
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
  // Editor surface: deterministic Tier-1 checks only — the CLI-only tier
  // consults process.env, which would make squiggles machine-dependent.
  const secrets = validateSecretHygiene(node, { surface: "editor" })
  const structural = collectStructuralDiagnostics(node)
  const changelog = collectChangelogDiagnostics(node)

  let expr: ValidationDiagnostic[] = []
  try {
    expr = await validateExpressionSyntax(node)
  } catch {
    // The SQL parser failed to load — skip expression validation rather than
    // failing the whole pass.
  }
  return [
    ...schema,
    ...connector,
    ...secrets,
    ...structural,
    ...changelog,
    ...expr,
  ]
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
    dagEdges: [],
    changelogModes: [],
    sinkChangelogAccepts: [],
    nodeInputSchemas: [],
    parallelism: null,
    tableSchemas: [],
    pipelineManifest: null,
    tapManifest: null,
    crdYaml: "",
    pipelineKind: "standard",
    artifacts: [],
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
    const { pipelineKind, artifacts } = buildArtifactSet(pipeline)
    return {
      ok: true,
      statements: [...sql.statements],
      sql: sql.sql,
      diagnostics,
      statementOrigins: decodeOrigins(sql.statementOrigins),
      statementContributors: decodeContributors(sql.statementContributors),
      statementMeta: decodeMeta(sql.statementMeta),
      edges: graphFacts.edges,
      dagEdges: graphFacts.dagEdges,
      changelogModes: graphFacts.changelogModes,
      sinkChangelogAccepts: graphFacts.sinkChangelogAccepts,
      nodeInputSchemas: graphFacts.nodeInputSchemas,
      parallelism: decodeParallelism(node, pipeline.crd),
      tableSchemas: graphFacts.tableSchemas,
      pipelineManifest: pipeline.pipelineManifest,
      tapManifest: decodeTapManifest(
        (pipeline as { tapManifest?: TapManifestLike | null }).tapManifest,
        node,
      ),
      crdYaml: toYaml(pipeline.crd),
      pipelineKind,
      artifacts,
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
