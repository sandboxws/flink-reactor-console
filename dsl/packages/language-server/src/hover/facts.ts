// Synthesis-fact accessors for hover.
//
// A thin, indexed read layer over a decoded `SynthesisResult`: it joins the
// flat decoded arrays (origins, contributors, meta, edges, changelog) into the
// per-node lookups the card builders need. Pure — no parsing, no synthesis,
// no recomputation. The facts were all paid for during synthesis; hover only
// reads and reshapes them.

import type { SynthesisResult } from "../synth/types.js"
import { getPropDoc, type PropDoc } from "./prop-docs.js"

/** `StatementMeta` as it arrives decoded (`meta: unknown`). */
interface StatementMetaView {
  readonly label?: string
  readonly kind?: string
  readonly component?: string
  readonly details?: ReadonlyArray<{ key: string; value: string }>
  readonly schema?: ReadonlyArray<{ name: string; type: string }>
}

export interface Column {
  readonly name: string
  readonly type: string
}

export interface NodeSchema {
  readonly columns: readonly Column[]
  /** Resolved output changelog mode (`append-only`/`retract`/`upsert`). */
  readonly changelogMode?: string
}

export interface Neighbor {
  readonly id: string
  /** Component when known (e.g. `KafkaSource`), else the node kind. */
  readonly label: string
  readonly kind: string
}

export interface Neighbors {
  readonly upstream: readonly Neighbor[]
  readonly downstream: readonly Neighbor[]
}

export interface EmittedSql {
  /** Whole statements this node is the `statementOrigins` owner of (source/sink `CREATE TABLE`). */
  readonly owned: readonly string[]
  /** Sliced byte-span contributions inside DML statements (a transform's `WHERE`/projection). */
  readonly fragments: readonly string[]
  /** Whole DML statements this node heads as the `INSERT INTO` target (sinks). */
  readonly dml: readonly string[]
}

interface NodeInfo {
  readonly component: string
  readonly kind: string
}

/** Indexed read view over one document version's synthesis result. */
export class HoverFacts {
  private readonly metaByStmt = new Map<number, StatementMetaView>()
  /** nodeId → statement indices it is the origin of. */
  private readonly ownedStmts = new Map<string, number[]>()
  /** nodeId → its inferred output schema (resolved across the banner offset). */
  private readonly schemaByNode = new Map<string, readonly Column[]>()
  /** Statement indices that have a `statementOrigins` owner (so DML — which has
   *  none — is detectable). */
  private readonly originStmts = new Set<number>()
  private readonly changelog = new Map<string, string>()
  private readonly sinkAccepts = new Map<string, readonly string[]>()
  private readonly info = new Map<string, NodeInfo>()
  /** to → froms (incoming) and from → tos (outgoing). */
  private readonly incoming = new Map<string, string[]>()
  private readonly outgoing = new Map<string, string[]>()
  /** nodeId → the schema feeding its expressions (resolved in the worker). */
  private readonly inputSchema = new Map<string, readonly Column[]>()

  constructor(private readonly result: SynthesisResult) {
    for (const m of result.statementMeta)
      this.metaByStmt.set(m.statementIndex, (m.meta ?? {}) as StatementMetaView)
    for (const o of result.statementOrigins) {
      push(this.ownedStmts, o.nodeId, o.statementIndex)
      this.originStmts.add(o.statementIndex)
      if (!this.schemaByNode.has(o.nodeId)) {
        const schema = this.resolveSchema(o.statementIndex, o.component)
        if (schema) this.schemaByNode.set(o.nodeId, schema)
      }
    }
    for (const c of result.changelogModes) this.changelog.set(c.nodeId, c.mode)
    for (const s of result.sinkChangelogAccepts)
      this.sinkAccepts.set(s.nodeId, s.accepts)
    for (const n of result.nodes)
      this.info.set(n.id, { component: n.component, kind: n.kind })
    for (const e of result.edges) {
      push(this.incoming, e.to, e.from)
      push(this.outgoing, e.from, e.to)
    }
    for (const s of result.nodeInputSchemas)
      this.inputSchema.set(
        s.nodeId,
        s.columns.map((c) => ({ name: c.name, type: c.type })),
      )
  }

  /** Whether synthesis produced SQL (vs a load/synth error result). */
  get ok(): boolean {
    return this.result.ok
  }

  getNodeInfo(nodeId: string): NodeInfo | undefined {
    return this.info.get(nodeId)
  }

  /**
   * The node's inferred output schema (columns + Flink types) and resolved
   * changelog mode. `columns` is empty for nodes whose statement carries no
   * schema (e.g. a transform); the card omits the table in that case.
   */
  getNodeSchema(nodeId: string): NodeSchema {
    return {
      columns: this.schemaByNode.get(nodeId) ?? [],
      changelogMode: this.changelog.get(nodeId),
    }
  }

  /**
   * The schema-bearing `StatementMeta` is attached to the comment banner that
   * immediately precedes a statement (index − 1), and carries no `nodeId` — so
   * it is paired to the origin node by adjacency + component, falling back to
   * the statement's own index.
   */
  private resolveSchema(
    originIndex: number,
    component: string,
  ): readonly Column[] | undefined {
    for (const idx of [originIndex - 1, originIndex]) {
      const meta = this.metaByStmt.get(idx)
      if (
        meta?.schema &&
        meta.schema.length > 0 &&
        (meta.component === undefined || meta.component === component)
      ) {
        return meta.schema.map((c) => ({ name: c.name, type: c.type }))
      }
    }
    return undefined
  }

  /**
   * The SQL this node emits: the whole statements it owns (source/sink DDL,
   * `INSERT INTO`) and the sliced byte-span fragments it contributes to other
   * statements (a transform's `WHERE`/projection). Fragments are the *exact*
   * substring of the generated SQL — sliced by `{offset,length}`, never
   * re-emitted.
   */
  getEmittedFragment(nodeId: string): EmittedSql {
    const owned: string[] = []
    for (const stmt of this.ownedStmts.get(nodeId) ?? []) {
      const text = this.result.statements[stmt]
      if (text && !isCommentOnly(text)) owned.push(text.trim())
    }

    const fragments: string[] = []
    const dml: string[] = []
    for (const contrib of this.result.statementContributors) {
      const text = this.result.statements[contrib.statementIndex]
      if (text === undefined) continue
      const mine = contrib.fragments.filter((f) => f.nodeId === nodeId)
      if (mine.length === 0) continue

      // A DML statement has no `statementOrigins` owner; the node that heads it
      // with the offset-0 `INSERT INTO`/`UPSERT` fragment is its target (a sink) —
      // show the whole statement. Every other contributor (a transform) shows
      // only its sliced fragment (the `WHERE`/projection it injected).
      const headsDml =
        !this.originStmts.has(contrib.statementIndex) &&
        mine.some(
          (f) =>
            f.offset === 0 && /^(INSERT|UPSERT)/i.test(text.slice(0, f.length)),
        )
      if (headsDml) {
        if (!isCommentOnly(text)) dml.push(text.trim())
        continue
      }
      for (const f of mine) {
        const slice = text.slice(f.offset, f.offset + f.length).trim()
        if (slice) fragments.push(slice)
      }
    }
    return { owned, fragments: dedupe(fragments), dml: dedupe(dml) }
  }

  /** Upstream and downstream neighbors from the dataflow graph. */
  getNeighbors(nodeId: string): Neighbors {
    const toNeighbor = (id: string): Neighbor => {
      const info = this.info.get(id)
      return {
        id,
        label: info?.component ?? info?.kind ?? id,
        kind: info?.kind ?? "",
      }
    }
    return {
      upstream: (this.incoming.get(nodeId) ?? []).map(toNeighbor),
      downstream: (this.outgoing.get(nodeId) ?? []).map(toNeighbor),
    }
  }

  /** Description / type / default for a connector prop (curated table). */
  getPropDoc(component: string, propName: string): PropDoc | undefined {
    return getPropDoc(component, propName)
  }

  /**
   * The schema feeding a node's expression — the columns available *to* a
   * `Filter` condition, a `Map` projection, a join `on`, a `Query.Select`, etc.
   * Prefers the worker-resolved per-node input schema (which reflects upstream
   * renames, joins, and windows, and inherits a parent's input for config
   * sub-nodes like `Query.Select`). Falls back to walking the nearest
   * schema-bearing upstream nodes for results without per-node schemas.
   */
  getUpstreamSchema(nodeId: string): readonly Column[] {
    const resolved = this.inputSchema.get(nodeId)
    if (resolved) return resolved

    const seen = new Set<string>([nodeId])
    const collected: Column[] = []
    const names = new Set<string>()
    let frontier = [...(this.incoming.get(nodeId) ?? [])]
    let depth = 0
    while (frontier.length > 0 && depth < 50) {
      const next: string[] = []
      for (const id of frontier) {
        if (seen.has(id)) continue
        seen.add(id)
        const cols = this.getNodeSchema(id).columns
        if (cols.length > 0) {
          for (const c of cols)
            if (!names.has(c.name)) {
              names.add(c.name)
              collected.push(c)
            }
        } else {
          next.push(...(this.incoming.get(id) ?? [])) // transparent transform — keep walking
        }
      }
      frontier = next
      depth += 1
    }
    return collected
  }

  /** Accepted changelog modes for a sink node, if known. */
  getSinkAccepts(nodeId: string): readonly string[] | undefined {
    return this.sinkAccepts.get(nodeId)
  }
}

// ── helpers ─────────────────────────────────────────────────────────

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/** A statement made up only of `--` comment lines (banners) carries no SQL. */
function isCommentOnly(text: string): boolean {
  return text
    .split("\n")
    .every((line) => line.trim() === "" || line.trim().startsWith("--"))
}
