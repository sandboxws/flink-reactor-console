// The `flinkReactor/schemaTree` wire contract (schema-navigation, Tier-2).
//
// A plain-JSON projection of one document version's sources and sinks for the
// VS Code Schema Explorer: each table carries its fields (`name`/`type` + a
// primary-key marker), an optional watermark, and `locationRef`s the tree uses
// to reveal declarations. Like the other custom requests it is a pure
// projection of already-held state — no re-synthesis — and the extension
// imports these types from `@flink-reactor/language-server` so host and tree
// share one contract.

/** A source location: a file URI plus a 0-based range (mirrors LSP `Location`). */
export interface SchemaTreeLocation {
  readonly uri: string
  readonly range: {
    readonly start: { readonly line: number; readonly character: number }
    readonly end: { readonly line: number; readonly character: number }
  }
}

/** One column of a table schema. */
export interface SchemaTreeField {
  readonly name: string
  readonly type: string
  /** True when the field is part of the schema's primary key. */
  readonly primaryKey: boolean
  /** The field key's declaration location (the `Schema({ fields })` key) when
   *  resolvable — absent for sink fields and computed/unresolvable schemas. */
  readonly locationRef?: SchemaTreeLocation
}

export interface SchemaTreeWatermark {
  readonly column: string
  readonly expression: string
}

/** A source or sink table in the active pipeline. */
export interface SchemaTableInfo {
  readonly nodeId: string
  readonly role: "source" | "sink"
  /** Component class (`KafkaSource`, `IcebergSink`, …). */
  readonly component: string
  /** Display label: the node's `name` prop, else its id. */
  readonly label: string
  readonly fields: readonly SchemaTreeField[]
  /** Present for sources that declare a watermark. */
  readonly watermark?: SchemaTreeWatermark
  /** The node's JSX location for top-level reveal — absent when the node is not
   *  mapped to a source range (e.g. a programmatically rendered node). */
  readonly locationRef?: SchemaTreeLocation
}

/** The `flinkReactor/schemaTree` response envelope. */
export interface SchemaTreeResponse {
  readonly uri: string
  /** The document version the model was built for; the client ignores a
   *  response older than what it has already rendered. */
  readonly version: number
  /** `false` when synthesis failed for this document — `error` is then set and
   *  the tree keeps its last-good tables behind a stale indicator. */
  readonly ok: boolean
  readonly error?: string
  readonly tables: readonly SchemaTableInfo[]
}

/** The `flinkReactor/schemaTree` request parameters. */
export interface SchemaTreeParams {
  readonly uri: string
  /** The version the client currently has, if any (advisory). */
  readonly version?: number
}

export const SCHEMA_TREE_REQUEST = "flinkReactor/schemaTree"
