# Statement-ordering invariants

Spec ID prefix: `ORD` | Status: active | Canonical for: the order and byte
layout of statements emitted by `generateSql`.

## Scope

Governs the output of `generateSql` / `generateSqlImpl`
(`src/codegen/sql/sql-generator.ts`) and the per-synthesis state in
`src/codegen/sql/sql-build-context.ts`. Does **not** govern the SQL text
*inside* a statement (that belongs to the per-component builders) or CRD
generation.

## Invariants

### ORD-1: Fixed section order
Statements MUST be emitted in this section order, with no interleaving:

| # | Section | Emits |
|---|---|---|
| 1 | configuration | `SET 'k' = 'v'` |
| 2 | catalogs | `CREATE CATALOG` |
| 3 | functions | `CREATE FUNCTION` (UDF) |
| 4 | sources | `CREATE TABLE` (sources) |
| 5 | sinks | `CREATE TABLE` (sinks) |
| 6 | views | `CREATE TEMPORARY VIEW` |
| 7 | materialized-tables | `CREATE MATERIALIZED TABLE` |
| 8 | pipeline | `INSERT INTO` / `EXECUTE STATEMENT SET` |

### ORD-2: DFS pre-order within a section
Within a section, nodes MUST appear in construct-tree DFS pre-order.
This falls out of `SynthContext.buildFromTree` (parent registered before
children, children in declaration order) plus `getNodesByKind` preserving
`Map` insertion order. Reordering JSX siblings therefore reorders DDL —
that is intended, observable behavior.

### ORD-3: DML wrapping rule
Exactly one DML entry MUST be emitted as a bare `INSERT INTO …;`. Two or
more MUST be wrapped in a single
`EXECUTE STATEMENT SET BEGIN\n…\nEND;` statement, with every contributing
fragment's byte offset shifted by the wrapper prefix and the joined
statements before it.

### ORD-4: Comment banners are non-executable statements
Comment banners are emitted as separate statement entries whose indices
are recorded in `commentIndices`. They MUST be excluded from SQL
verification (`verifySql`) and from anything that executes statements.

### ORD-5: Byte-stability of the joined output
`result.sql` MUST be exactly `statements.join("\n\n") + "\n"`. Identical
input trees MUST produce byte-identical `sql`. Snapshots and the
black-box determinism check both pin this.

### ORD-6: Pipeline Connector short-circuit
A tree containing a Pipeline Connector source (component in
`PIPELINE_CONNECTOR_SOURCES`, currently `PostgresCdcPipelineSource`) MUST
short-circuit to banner comments only: no executable SQL, empty
diagnostics. The runtime definition lives in `pipeline.yaml`, not SQL.

### ORD-7: Non-reentrancy
`generateSql` MUST NOT be re-entered synchronously. The module-level
`_activeSynthesisCount` tripwire in `sql-build-context.ts` throws on
re-entry (the usual trigger: a plugin calling `generateSql` inside a tree
transformer). Fragment accumulators would interleave otherwise.

### ORD-8: Optimizer SET placement
SET statements contributed by the optimizer MUST be appended after the
pipeline-prop SET statements, still inside the configuration section.

## Rationale

Deterministic ordering is a core value proposition ("same input must
always produce the same SQL and YAML" — CLAUDE.md). Downstream consumers
depend on it independently: snapshot tests diff raw bytes, the LSP maps
statement indices to nodes (`statementOrigins`/`statementContributors`),
the dashboard keys hover metadata by statement index, and Flink itself
requires DDL before the DML that references it. A statement inserted out
of order breaks index-keyed metadata even when the SQL is still valid.

Note: `View` nodes emit DDL only when they have children — a childless
`View` is a reference, not a definition.

## Enforced by

| Invariant | Test |
|---|---|
| ORD-1, ORD-2, ORD-5 | `src/codegen/__tests__/example-snapshots.test.ts` (full-output snapshots) |
| ORD-3 | `src/codegen/__tests__/sql-generator.test.ts` (statement-set suites) |
| ORD-5 | `src/codegen/__tests__/determinism.test.ts` ("synth() output is bit-stable") |
| ORD-6 | indirect only: `src/__tests__/paimon-sink-cdc.test.ts`, `src/codegen/__tests__/crd-generator.test.ts` (pipeline-connector path); **gap** — no test asserts the SQL banner short-circuit directly |
| ORD-7 | `src/codegen/__tests__/determinism.test.ts` ("reentrant-safe across calls") |

## Violations seen historically

- `bugs/018-statement-set-type-mismatch.md` — DML wrapping interacted
  badly with sink-type resolution (ORD-3 territory).
- `bugs/012-source-children-ignored-in-build-query.md` — emission order
  assumptions vs. tree shape (ORD-2 territory).
