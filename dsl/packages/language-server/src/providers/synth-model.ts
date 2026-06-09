// `flinkReactor/synth` assembler.
//
// A pure, host-side re-projection of one document version's decoded
// `SynthesisResult` into the plain-JSON `SynthResponse` the SQL-preview webview
// renders. It serializes the worker-decoded source maps (`statementOrigins`,
// `statementContributors`, `statementMeta`) back into the `[index, value]`
// entry arrays the wire contract uses — NO synthesis, no DSL objects, no SQL
// re-emitted. The flat decoded arrays already carry the statement index each
// entry belongs to, so this is a straight shape transform.

import { redactSqlText } from "@flink-reactor/dsl/browser"
import type {
  SynthFragment,
  SynthPipeline,
  SynthResponse,
  SynthStatementMeta,
  SynthStatementOrigin,
} from "../preview/model.js"
import type { SynthesisResult } from "../synth/types.js"

/** The container kind that wraps the pipeline — its `name` prop is the
 *  pipeline's identity. */
const CONTAINER_KIND = "Pipeline"

/** `StatementMeta` as it arrives decoded (`meta: unknown`). Only the fields the
 *  preview needs are read; the rest of the DSL `StatementMeta` is ignored. */
interface StatementMetaView {
  readonly label?: string
  readonly section?: string
  readonly kind?: string
  readonly component?: string
}

/**
 * Build the SQL-preview model for a synthesized document. Never throws: a
 * failed synthesis (`result.ok === false`) becomes an `ok: false` envelope
 * carrying the load-error message as the failure summary, with the last good
 * SQL left to the webview.
 */
export function buildSynthModel(
  uri: string,
  version: number,
  result: SynthesisResult,
): SynthResponse {
  if (!result.ok) {
    return {
      uri,
      version,
      ok: false,
      error: result.loadError?.message ?? "synthesis failed",
      pipelines: [],
    }
  }

  // statement index → producing node (drop nothing; synthetic statements simply
  // have no origin entry).
  const statementOrigins = result.statementOrigins.map(
    (o): readonly [number, SynthStatementOrigin] => [
      o.statementIndex,
      { nodeId: o.nodeId, component: o.component, kind: o.kind },
    ],
  )

  // statement index → contributing byte spans. The decoded fragment flattens
  // the DSL `SqlFragment.origin` to `nodeId`; the wire keeps that as `origin`.
  const statementContributors = result.statementContributors.map(
    (c): readonly [number, readonly SynthFragment[]] => [
      c.statementIndex,
      c.fragments.map(
        (f): SynthFragment => ({
          offset: f.offset,
          length: f.length,
          origin: f.nodeId,
        }),
      ),
    ],
  )

  // statement index → block label + section.
  const statementMeta = result.statementMeta.map(
    (m): readonly [number, SynthStatementMeta] => {
      const meta = (m.meta ?? {}) as StatementMetaView
      return [
        m.statementIndex,
        {
          label: meta.label ?? "",
          section: meta.section ?? "",
          ...(meta.kind ? { kind: meta.kind } : {}),
          ...(meta.component ? { component: meta.component } : {}),
        },
      ]
    },
  )

  const pipeline: SynthPipeline = {
    id: pipelineIdentity(result),
    // Preview surface: mask credential-bearing WITH values. The raw
    // statements stay on `SynthesisResult` — gateway deep-validate
    // submits those, not this projection.
    statements: result.statements.map(redactSqlText),
    statementOrigins,
    statementContributors,
    statementMeta,
  }

  return { uri, version, ok: true, pipelines: [pipeline] }
}

/** The pipeline's identity: the `<Pipeline name>` prop carried on the container
 *  node, else `"pipeline"`. Stable across refreshes so the webview can re-bind
 *  to the same pipeline in a multi-pipeline document. */
function pipelineIdentity(result: SynthesisResult): string {
  const container = result.nodes.find((n) => n.kind === CONTAINER_KIND)
  return container?.name ?? "pipeline"
}
