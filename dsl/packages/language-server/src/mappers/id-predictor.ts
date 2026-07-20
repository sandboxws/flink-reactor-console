// Mirror of the DSL's `generateNodeId` + per-component `_nameHint` rules
// (`src/core/jsx-runtime.ts` and the source/sink component factories).
//
// The server never runs the user's `createElement` calls to *learn* node IDs
// before synthesis — it re-derives them from the AST. For that to match the
// authoritative IDs, this file must stay byte-for-byte faithful to the DSL's
// ID scheme. The parity test (`__tests__/parity.test.ts`) is the gate: it
// runs real `synthesizeApp` over every fixture and asserts the predicted IDs
// match the authoritative ones.

/** Static prop bag extracted from JSX/`createElement` (string literals only;
 *  computed props are absent because they can't be predicted statically). */
export type StaticProps = Record<string, string | undefined>

/**
 * Exact copy of the DSL's `toSqlIdentifier` (`src/core/jsx-runtime.ts`).
 * Kept in lock-step — any divergence mislocates diagnostics.
 */
export function toSqlIdentifier(value: string): string {
  return value
    .replace(/[.\-/]/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

/** Last path segment, mirroring `FileSystemSink`'s name derivation. */
function lastPathSegment(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/")
  return segments[segments.length - 1] ?? path
}

type HintRule = (props: StaticProps) => string | undefined

/**
 * Per-component name-hint rules. ONLY the components below set `_nameHint` in
 * the DSL; everything else (Pipeline, all transforms/joins/windows/catalogs,
 * `CatalogSource`, and the Paimon/Iceberg/Fluss sinks) uses the counter
 * scheme. Each rule returns `undefined` when the identifying prop isn't a
 * static string — then the predictor falls back to the counter, which the
 * mismatch detector will flag if it diverges from the real (computed-prop) ID.
 */
const NAME_HINT_RULES: Readonly<Record<string, HintRule>> = {
  // Sources
  KafkaSource: (p) => p.name ?? p.topic,
  JdbcSource: (p) => p.name ?? p.table,
  GenericSource: (p) => p.name ?? p.connector,
  PostgresCdcPipelineSource: (p) => p.name ?? p.database,
  DataGenSource: (p) => p.name ?? "datagen",
  FlussSource: (p) =>
    p.name ?? (p.database && p.table ? `${p.database}_${p.table}` : undefined),
  // Sinks
  KafkaSink: (p) => p.name ?? p.topic,
  JdbcSink: (p) => p.name ?? p.table,
  FileSystemSink: (p) =>
    p.name ?? (p.path ? lastPathSegment(p.path) : undefined),
  GenericSink: (p) => p.name ?? p.connector,
}

/**
 * Stateful predictor mirroring the DSL's module-level `nextNodeId` counter and
 * `usedNodeIds` set. Create one per document and call `predict` once per
 * element in **creation (post-order) order**.
 */
export class IdPredictor {
  private counter = 0
  private readonly used = new Set<string>()

  predict(component: string, props: StaticProps): string {
    const rule = NAME_HINT_RULES[component]
    const hint = rule ? rule(props) : undefined

    // Mirror `generateNodeId`: unnamed nodes embed the current counter value
    // and post-increment; named nodes derive their base from the hint.
    const base = hint ? toSqlIdentifier(hint) : `${component}_${this.counter++}`

    let id = base
    let suffix = 2
    while (this.used.has(id)) {
      id = `${base}_${suffix}`
      suffix++
    }
    this.used.add(id)

    // Named nodes keep the counter moving so unnamed siblings stay in sync.
    if (hint) this.counter++

    return id
  }

  /** Whether a component derives a name-based ID (vs. the counter scheme). */
  static isNameDerived(component: string): boolean {
    return component in NAME_HINT_RULES
  }
}
