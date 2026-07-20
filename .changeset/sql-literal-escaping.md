---
"@flink-reactor/dsl": patch
---

Escape single quotes in every generated SQL string literal. Connector `WITH` option keys and values, `SET` statements, `CREATE CATALOG` options, `CREATE FUNCTION ... AS '<class>'`, materialized-table `COMMENT` and table options, and side-output tag literals now route through shared `quoteStringLiteral` / `sqlOption` / `formatWithClause` helpers. A value — or user-provided option key — containing a `'` (passwords, connection strings, comments like `user's events`) no longer breaks out of its literal and emits malformed SQL.

Connector `WITH`-clause keys are now emitted in canonical sorted order (Flink reads `WITH` as an unordered property bag), matching the existing tap-clause behaviour. This changes the byte order of generated `WITH` clauses — regenerate any committed SQL snapshots — but is otherwise semantically identical.

Also: tapping a sibling-chain transform with no resolvable upstream connector now emits a clear, actionable diagnostic instead of "Tap is not supported for unknown connectors".
