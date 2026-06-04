// Synthesis-fact accessors for inlay hints (schema-inlay-hints, Tier-3
// feature 10).
//
// The same projection hover performs — node → already-synthesized facts — but
// shaped for bulk, per-range annotation. Composes the indexed `HoverFacts`
// read layer (statementMeta schemas, changelog modes, dataflow neighbors,
// worker-resolved input schemas) and adds the two derivations hints need:
//
//   output schema — a source/sink reads its authoritative DDL schema from
//     `statementMeta`; a transform's output is, by construction, the *input*
//     of its first downstream node (the worker folded `resolveTransformSchema`
//     along the dataflow graph), so windows/joins/projections are reflected
//     without recomputing anything host-side.
//   parallelism — the pipeline-scoped effective parallelism decoded in the
//     worker from the generated CRD (Flink SQL parallelism is job-level, so
//     one value annotates every node).
//
// Pure reads over the per-document-version synthesis state. Never re-runs
// synthesis; never throws. When the synthesis result trails the document
// version (mid-edit failure, pending debounce) `nodeFactsFor` returns the
// "unavailable" marker (`undefined`) and the provider answers empty.

import type { DocumentSynthState } from "../document-state.js"
import { HoverFacts } from "../hover/facts.js"
import type { DecodedParallelism } from "../synth/types.js"

export interface Column {
  readonly name: string
  readonly type: string
}

/** The per-node facts an inlay hint renders. */
export interface NodeFacts {
  /** Inferred output columns; empty when no schema is resolvable. */
  readonly schema: readonly Column[]
  /** Resolved output changelog mode (`append-only`/`retract`/`upsert`). */
  readonly changelogMode?: string
  /** The pipeline's resolved effective parallelism (job-scoped). */
  readonly parallelism?: DecodedParallelism
}

/** Window components that inject `window_start`/`window_end` downstream. */
const WINDOW_COMPONENTS: ReadonlySet<string> = new Set([
  "TumbleWindow",
  "SlideWindow",
  "SessionWindow",
])

/** Join components annotated with their merged output column count. */
const JOIN_COMPONENTS: ReadonlySet<string> = new Set([
  "Join",
  "TemporalJoin",
  "LookupJoin",
  "IntervalJoin",
  "LateralJoin",
])

const WINDOW_TIME_COLUMNS: ReadonlySet<string> = new Set([
  "window_start",
  "window_end",
])

/** Node kinds that carry no dataflow facts worth annotating: the `<Pipeline>`
 *  container and catalog declarations. Their changelog entries are vacuous
 *  (`append-only` placeholders), so a hint there would be noise. */
const EXCLUDED_KINDS: ReadonlySet<string> = new Set(["Pipeline", "Catalog"])

/** Indexed fact reads for one document version's synthesis result. */
export class NodeFactsIndex {
  private readonly hover: HoverFacts
  private readonly parallelism: DecodedParallelism | null
  private readonly components = new Map<string, string>()
  private readonly kinds = new Map<string, string>()

  constructor(state: DocumentSynthState) {
    this.hover = new HoverFacts(state.result)
    this.parallelism = state.result.parallelism
    for (const n of state.result.nodes) {
      this.components.set(n.id, n.component)
      this.kinds.set(n.id, n.kind)
    }
  }

  /** Whether this node is a dataflow participant worth annotating (sources,
   *  transforms, windows, joins, sinks — not the Pipeline container or a
   *  catalog declaration). */
  isAnnotatable(nodeId: string): boolean {
    const kind = this.kinds.get(nodeId)
    return kind !== undefined && !EXCLUDED_KINDS.has(kind)
  }

  /** The node's schema/changelog/parallelism facts (task 1.2). */
  getNodeFacts(nodeId: string): NodeFacts {
    return {
      schema: this.outputSchema(nodeId),
      changelogMode: this.hover.getNodeSchema(nodeId).changelogMode,
      parallelism: this.parallelism ?? undefined,
    }
  }

  /** The injected `window_start`/`window_end` columns a window node adds to
   *  the synthesized downstream schema (task 1.3). Empty for non-windows. */
  getWindowColumns(nodeId: string): readonly Column[] {
    if (!this.isWindow(nodeId)) return []
    return this.outputSchema(nodeId).filter((c) =>
      WINDOW_TIME_COLUMNS.has(c.name),
    )
  }

  /** The merged (deduplicated) resulting column count of a join node's
   *  synthesized output schema (task 1.4). `undefined` for non-joins or when
   *  no schema is resolvable. */
  getJoinColumnCount(nodeId: string): number | undefined {
    if (!this.isJoin(nodeId)) return undefined
    const schema = this.outputSchema(nodeId)
    return schema.length > 0 ? schema.length : undefined
  }

  isWindow(nodeId: string): boolean {
    return WINDOW_COMPONENTS.has(this.components.get(nodeId) ?? "")
  }

  isJoin(nodeId: string): boolean {
    return JOIN_COMPONENTS.has(this.components.get(nodeId) ?? "")
  }

  /**
   * A node's inferred *output* schema. Sources/sinks carry it authoritatively
   * on their DDL `statementMeta`; for everything else it equals the input
   * schema of the first downstream node (worker-resolved, so renames, window
   * time-column injection, and join merges are already applied). A node with
   * neither — e.g. a config sub-node like the `Aggregate` nested inside a
   * window, which has no dataflow edge of its own — yields no schema rather
   * than a guess: its own *input* is resolvable but would mislabel what it
   * emits, and absence beats a wrong fact.
   */
  private outputSchema(nodeId: string): readonly Column[] {
    const own = this.hover.getNodeSchema(nodeId).columns
    if (own.length > 0) return own
    const downstream = this.hover.getNeighbors(nodeId).downstream
    for (const next of downstream) {
      const viaDownstream = this.hover.getUpstreamSchema(next.id)
      if (viaDownstream.length > 0) return viaDownstream
    }
    return []
  }
}

/**
 * The facts index for the current document version, or the "unavailable"
 * marker (`undefined`) when there is nothing trustworthy to annotate: no
 * synthesis yet, a failed synthesis, or a result that trails the document
 * version (pending debounce / mid-edit). Showing nothing is strictly better
 * than showing stale or mislocated facts.
 */
export function nodeFactsFor(
  state: DocumentSynthState | undefined,
  documentVersion: number,
): NodeFactsIndex | undefined {
  if (!state || !state.result.ok) return undefined
  if (state.version !== documentVersion) return undefined
  return new NodeFactsIndex(state)
}
