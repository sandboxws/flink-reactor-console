# Sandbox Branch Bug Fix Report

**Branch:** `sandbox` (flink-reactor-dsl)
**Period:** March 15–16, 2026
**Author:** Automated analysis from 22 commits

---

## 1. Executive Summary

The `sandbox` branch contains **22 commits** that introduced a two-tier SQL testing model and fixed **14 numbered bugs** (BUG-001 through BUG-014) discovered by running generated SQL through Flink's `EXPLAIN` endpoint against a live cluster.

| Metric | Count |
|--------|-------|
| Total commits | 22 |
| Numbered bug fixes | 14 |
| Supporting commits (infra, reports, schema) | 8 |
| Primary files modified | `sql-generator.ts`, `schema-introspect.ts` |
| Examples fixed | 25+ (out of 34 total) |

**Risk distribution:**

| Risk Level | Bugs | Description |
|------------|------|-------------|
| 🔴 High | BUG-004, BUG-008, BUG-009, BUG-010 | Major codegen rewrites affecting multiple node types |
| 🟡 Medium | BUG-001, BUG-002, BUG-003, BUG-006, BUG-007, BUG-012, BUG-014 | Targeted fixes with moderate blast radius |
| 🟢 Low | BUG-005, BUG-011, BUG-013 | Example-level or narrow fixes |

---

## 2. Test Infrastructure

### Two-Tier Testing Model

Introduced in commit `85016b8`:

| Tier | Type | Infrastructure | Purpose |
|------|------|---------------|---------|
| **Tier 1** | Snapshot tests | None (pure unit) | Fast regression on SQL output shape |
| **Tier 2** | EXPLAIN integration | Live Flink cluster via SQL Gateway | Validates SQL is syntactically and semantically valid |

### How EXPLAIN Tests Work

1. DSL examples (34 total: 25 existing + 9 sandbox-derived 30–38) are synthesized to SQL
2. Each generated SQL statement is sent to the Flink SQL Gateway `EXPLAIN` endpoint
3. Flink parses, validates types, and returns an execution plan — or errors
4. Tier 2 skips gracefully when no cluster is available

### Docker Cluster Requirements

The EXPLAIN tests require a running Flink cluster with SQL Gateway. The `flink-reactor-dsl` local dev cluster provides:
- Flink JobManager + TaskManager
- SQL Gateway endpoint
- Kafka (for connector validation)
- PostgreSQL with TimescaleDB extension

### Example Coverage

**34 examples total** (directories 01–28, 30–38):

- Examples 09, 10, 17, 29 are absent (removed or never created)
- Examples 30–38 are new sandbox-derived examples covering: FlatMap/UNNEST, TopN ranking, Union streams, Rename fields, Drop fields, Cast types, Coalesce defaults, Add computed field, Dedup aggregate

---

## 3. Bug Fix Details

### BUG-001: Sink schema type mismatch for windowed aggregates

| Field | Value |
|-------|-------|
| **Commit** | `d9d29f1` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 05, 12, 14 |
| **Root cause** | Backward walk in sink schema resolution treated Window nodes with Aggregate children as starting points. Since Aggregate has no source children in JSX patterns, type inference fell back to `STRING` for all columns. |
| **Fix** | Use `findDeepestSource()` to skip intermediate Windows. Recognize Join nodes as valid starting points. Add `FIRST_VALUE`/`LAST_VALUE` to type-preserving aggregate list. |
| **Files** | `schema-introspect.ts`, `sql-generator.ts` |

### BUG-002: Joins generating `SELECT * FROM unknown` in DML

| Field | Value |
|-------|-------|
| **Commit** | `45262b8` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 06, 08, 15, 16, 18, 21, 25 |
| **Root cause** | `buildSiblingChainQuery` and `resolveRouteUpstream` only recognized `Source`, `Transform`, and `Window` kinds. Join nodes have their own `"Join"` kind and were silently skipped, causing downstream transforms to emit `SELECT * FROM unknown`. |
| **Fix** | Add `"Join"` to all kind-check arrays in the sibling chain and route upstream logic. |
| **Files** | `sql-generator.ts` |

### BUG-003: Malformed `TABLE()` clause in windowed queries

| Field | Value |
|-------|-------|
| **Commit** | `e926fab` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 11, 19, 38 |
| **Root cause** | Flink TVF syntax requires `TABLE <identifier>`, not `TABLE (<subquery>)`. When the window's upstream is a subquery (from Deduplicate or Union), the generated SQL was invalid. |
| **Fix** | Detect subquery upstreams and lift them into a CTE: `WITH _windowed_input AS (<subquery>) SELECT ... FROM TABLE(TUMBLE(TABLE _windowed_input, ...))`. |
| **Files** | `sql-generator.ts` |

### BUG-004: Filesystem sink partition syntax and missing schemas

| Field | Value |
|-------|-------|
| **Commit** | `f946809` |
| **Risk** | 🔴 High |
| **Affected examples** | 23, 24, 25 |
| **Root cause** | Three separate issues: (1) `findRouteUpstreamNode` didn't recognize `"Join"` kind, (2) function expressions in `partitionBy` (e.g. `DATE(col)`) were emitted as raw expressions in `PARTITIONED BY`, (3) DML lacked computed partition projections. |
| **Fix** | (1) Add `"Join"` to route upstream. (2) Generate physical partition columns in DDL for function-based partitions. (3) Wrap DML with computed partition column projections. Largest single fix at **126+ lines** added to `sql-generator.ts`. |
| **Files** | `sql-generator.ts`, `schema-introspect.ts` |

### BUG-005: FlatMap UNNEST alias mismatch

| Field | Value |
|-------|-------|
| **Commit** | `ef718c7` |
| **Risk** | 🟢 Low |
| **Affected examples** | 30 |
| **Root cause** | Source schema used `ARRAY<STRING>` but FlatMap declared 3 output columns. `UNNEST` of `ARRAY<STRING>` produces only 1 column. |
| **Fix** | Change `line_items` type to `ARRAY<ROW<product_id STRING, quantity INT, price DECIMAL(10,2)>>` so `UNNEST` produces a structured row matching the 3 aliases. |
| **Files** | `examples/30-flatmap-unnest/after.tsx` |

### BUG-006: Session window timestamp arithmetic and changelog mode

| Field | Value |
|-------|-------|
| **Commit** | `af3413e` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 12 |
| **Root cause** | (1) Direct `TIMESTAMP` subtraction not supported in Flink, (2) session windows can merge on late events (retract), but `propagateChangelogMode` didn't mark them, (3) `propagatePrimaryKey` didn't extract `groupBy` from Aggregate children inside Window nodes. |
| **Fix** | (1) Use `TIMESTAMPDIFF(SECOND, ...)`. (2) Mark SessionWindow as retract so JdbcSink gets `PRIMARY KEY`. (3) Extract `groupBy` for PK propagation. (4) Add `TIMESTAMPDIFF → INT` to `inferExpressionType`. |
| **Files** | `sql-generator.ts`, `schema-introspect.ts`, `examples/12-session-window/after.tsx` |

### BUG-007: MatchRecognize excluded from sibling chain

| Field | Value |
|-------|-------|
| **Commit** | `f14be33` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 15 |
| **Root cause** | CEP kind was missing from all sibling chain filters, backward walk conditions, and route upstream resolution in both `sql-generator.ts` and `schema-introspect.ts`. Also, `COUNT(B.*)` syntax is not supported by Flink in `MATCH_RECOGNIZE`. |
| **Fix** | Add `"CEP"` kind to all node-type checks. Fix `COUNT(B.*)` → `COUNT(B.transaction_id)` in example 15. |
| **Files** | `sql-generator.ts`, `schema-introspect.ts`, `examples/15-cep-fraud-detection/after.tsx` |

### BUG-008: Window inside Route branch can't find upstream

| Field | Value |
|-------|-------|
| **Commit** | `d7bf08d` |
| **Risk** | 🔴 High |
| **Affected examples** | 21, 28 |
| **Root cause** | (1) `buildBranchQuery` replaced Window children instead of appending VirtualRef alongside them. (2) `resolveRouteUpstream` only referenced the nearest sibling, not the full chain. (3) Route handler didn't do a backward walk for schema resolution. |
| **Fix** | Major refactor of route branch handling: VirtualRef injection, full sibling chain build for route upstream, backward walk pattern for schema resolution. **113+ lines** changed in `sql-generator.ts`. |
| **Files** | `sql-generator.ts` |

### BUG-009: Chained joins referencing intermediate node IDs as tables

| Field | Value |
|-------|-------|
| **Commit** | `dfdae6a` |
| **Risk** | 🔴 High |
| **Affected examples** | 08 |
| **Root cause** | Join operands used `resolveRef` which only works for Source nodes with table names. Intermediate join results have node IDs, not table names, producing invalid SQL like `FROM join_abc123`. |
| **Fix** | Add `resolveJoinOperand()` helper that detects non-Source join operands and inlines their SQL as CTEs. Updated all 4 join builders (`buildJoinQuery`, `buildTemporalJoinQuery`, `buildLookupJoinQuery`, `buildIntervalJoinQuery`). |
| **Files** | `sql-generator.ts`, `examples/08-multi-stream-join/after.tsx` |

### BUG-010: KafkaSource with PK requires upsert-kafka connector

| Field | Value |
|-------|-------|
| **Commit** | `5d68dcd` |
| **Risk** | 🔴 High |
| **Affected examples** | 16, 18 |
| **Root cause** | KafkaSource DDL always used `'connector' = 'kafka'` regardless of whether a primary key was defined. Flink requires `upsert-kafka` connector when a PK is present with non-changelog formats. |
| **Fix** | Detect PK + non-changelog format (json, avro, csv) and switch to `upsert-kafka` with `key.format`/`value.format` properties. Exclude changelog formats (debezium-json, canal-json) from the switch. |
| **Files** | `sql-generator.ts` |

### BUG-011: Anti-join retract with KafkaSink missing PK

| Field | Value |
|-------|-------|
| **Commit** | `535ef6a` |
| **Risk** | 🟢 Low |
| **Affected examples** | 18 |
| **Root cause** | Anti-join detected as retract, PK propagated from left source, but sink DDL lacked a primary key, causing upsert-kafka to fail. |
| **Fix** | Add `primaryKey` to `EventSchema` so the full chain works: Source (PK + json → upsert-kafka) → Anti-join (retract, PK propagated) → Sink (retract + PK → upsert-kafka with PRIMARY KEY). |
| **Files** | `examples/18-broadcast-join/after.tsx` |

### BUG-012: Source nodes ignoring child transforms in `buildQuery`

| Field | Value |
|-------|-------|
| **Commit** | `c2c67d0` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 32 (Union with nested transforms) |
| **Root cause** | Source nodes (`KafkaSource`, `JdbcSource`, `GenericSource`) with children returned a bare `SELECT * FROM table`, ignoring child transforms like `<KafkaSource><Map/></KafkaSource>`. |
| **Fix** | Chain through child transforms using VirtualRef injection when source nodes have children, matching the pattern used elsewhere in the generator. |
| **Files** | `sql-generator.ts` |

### BUG-013: `SUM(CASE ...)` type inferred as STRING

| Field | Value |
|-------|-------|
| **Commit** | `f86010f` |
| **Risk** | 🟢 Low |
| **Affected examples** | 20 |
| **Root cause** | `inferExpressionType` used a regex that only matched `SUM(column_name)`. Complex expressions like `SUM(CASE WHEN ... END)` didn't match, falling back to `STRING`. |
| **Fix** | Add broader `/^SUM\s*\(/` test that returns `BIGINT` as a safe default when the column-name regex doesn't match (SUM always produces a numeric type). |
| **Files** | `schema-introspect.ts` |

### BUG-014: Partition column types and `scan.startup.mode` regression

| Field | Value |
|-------|-------|
| **Commit** | `f97bd81` |
| **Risk** | 🟡 Medium |
| **Affected examples** | 21, 23, 25 |
| **Root cause** | (1) `HOUR()`/`YEAR()`/`MONTH()`/`DAY()` functions return `BIGINT` in Flink, but `resolvePartitionExpression` typed them as `INT`. (2) BUG-010 fix regressed `scan.startup.mode` for changelog-format Kafka sources with PK. |
| **Fix** | Use `BIGINT` for all time-part partition functions. Only skip `scan.startup.mode` for actual `upsert-kafka` sources, not changelog-format sources with PK. |
| **Files** | `sql-generator.ts` |

---

## 4. Supporting Commits

| Commit | Description |
|--------|-------------|
| `6008985` | **SQL comment blocks**: Added self-documenting comment blocks to generated SQL with type labels, separators, and metadata (PIPELINE, SOURCE TABLE, SINK TABLE, etc.) |
| `2666cf2` | **Schema introspection fix**: Window nodes append `window_start`/`window_end`, Deduplicate/TopN append `rownum BIGINT`, FlatMap appends unnested columns — prerequisite for EXPLAIN validation |
| `85016b8` | **Two-tier test infrastructure**: Snapshot tests (Tier 1) + EXPLAIN integration tests (Tier 2) with Docker cluster, 9 new examples (30–38) |
| `8145403` | **Bug report batch 1**: Documented 17 codegen issues found by EXPLAIN tests, categorized into 6 root causes (BUG-001 through BUG-006) |
| `db3a36a` | **Bug report batch 2**: Documented 8 remaining issues (BUG-007 through BUG-014) |
| `ae5354b` | **TSX example fixes**: Fixed 8 examples — table-qualified ON conditions, `TIMESTAMPDIFF` usage, replaced s3:// with /tmp/ and parquet with json for test environments |
| `242928c` | **Join schema resolution**: `resolveNodeSchema` now merges both sides' schemas for Join/IntervalJoin/TemporalJoin, deduplicating join key columns |
| `3e066b2` | **MatchRecognize schema + final fixes**: `resolveNodeSchema` builds output schema from PARTITION BY + MEASURES for CEP nodes; fixed example 25 join `SELECT *` issue |

---

## 5. Cross-Cutting Regression Analysis

### Pattern 1: Node-Kind Exhaustiveness

**Bugs affected:** BUG-002, BUG-004, BUG-007

Multiple places in the codebase filter on node kinds (`Source`, `Transform`, `Window`) but missed `Join` and `CEP`. Each new node kind requires updating **every** kind-check across `sql-generator.ts` and `schema-introspect.ts`.

**Regression risk:** 🔴 **High** — Adding a new node kind in the future will silently fail in any kind-check that isn't updated. Consider an enum-exhaustiveness approach or a centralized `isChainableKind()` predicate.

### Pattern 2: VirtualRef Injection Consistency

**Bugs affected:** BUG-008, BUG-012

The `VirtualRef` pattern (injecting a virtual table reference into child nodes) is used in `buildSiblingChainQuery`, `buildBranchQuery`, and now source nodes. Each builder had its own variant, and BUG-008/012 showed that some were incomplete.

**Regression risk:** 🟡 **Medium** — The pattern is now applied in 3+ places. A refactor to a shared `injectVirtualRef()` helper would reduce drift.

### Pattern 3: Connector Property Logic

**Bugs affected:** BUG-010, BUG-011, BUG-014

The kafka/upsert-kafka connector selection interacts with PK detection, changelog mode propagation, and `scan.startup.mode`. BUG-014 was a direct regression from the BUG-010 fix.

**Regression risk:** 🔴 **High** — Connector property generation has complex conditional logic. A truth-table test covering all combinations (PK × format × changelog × connector) would catch future regressions.

### Pattern 4: Type Inference Fallback

**Bugs affected:** BUG-001, BUG-006, BUG-013, BUG-014

Type inference in `schema-introspect.ts` uses regex matching and has multiple fallback paths. Several bugs were caused by the final fallback returning `STRING` for unrecognized patterns.

**Regression risk:** 🟡 **Medium** — New aggregate functions or expressions may still fall through to `STRING`. Consider a stricter default (fail loudly) or a more comprehensive expression parser.

### Pattern 5: Route Branch Complexity

**Bugs affected:** BUG-004, BUG-008, BUG-014

Route branches (multi-sink patterns) interact with window placement, partition generation, and upstream resolution. Three separate bugs surfaced in this area, each requiring different fixes.

**Regression risk:** 🟡 **Medium** — Route branch code paths are exercised by examples 21, 23, 24, 25, 28. Maintaining good example coverage for multi-sink patterns is essential.

---

## 6. CI Recommendations for `test:explain`

### Option A: Nightly EXPLAIN Tests

**Best for:** Teams that want low CI cost and can tolerate overnight bug detection.

```yaml
# .github/workflows/nightly-explain.yml
name: EXPLAIN Integration Tests
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC daily
  workflow_dispatch: {}

jobs:
  explain-tests:
    runs-on: ubuntu-latest
    services:
      flink-jobmanager:
        image: flink:1.19-scala_2.12-java17
        # ... SQL Gateway config
      kafka:
        image: confluentinc/cp-kafka:7.6.0
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:explain
        env:
          SQL_GATEWAY_URL: http://localhost:8083
```

**Pros:** No PR latency impact, catches regressions within 24h
**Cons:** Bugs discovered after merge, not before

### Option B: Per-PR with Docker Layer Caching

**Best for:** Teams that want pre-merge validation and can afford ~3-5 min CI overhead.

```yaml
# .github/workflows/pr-explain.yml
name: EXPLAIN Tests (PR)
on:
  pull_request:
    paths:
      - 'src/codegen/**'
      - 'src/examples/**'

jobs:
  explain-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: actions/cache@v4
        with:
          path: /tmp/.docker-cache
          key: flink-cluster-${{ hashFiles('docker-compose.test.yml') }}
      - run: docker compose -f docker-compose.test.yml up -d
      - run: pnpm install
      - run: pnpm test:explain
        env:
          SQL_GATEWAY_URL: http://localhost:8083
      - run: docker compose -f docker-compose.test.yml down
```

**Pros:** Catches bugs before merge, path-scoped to minimize unnecessary runs
**Cons:** ~3-5 min added to affected PRs

### Image Optimization

| Strategy | Savings |
|----------|---------|
| Pre-built test image with connectors | Avoid downloading JARs on every run |
| Slim Flink image (no UI, no metrics) | ~200MB smaller |
| Parallel startup (Flink + Kafka) | ~30s faster boot |
| Cached pnpm store (`actions/cache`) | ~15s faster install |

### Recommendation

**Start with Option A (nightly)** to validate the approach with zero PR impact, then graduate to **Option B (per-PR, path-scoped)** once the cluster startup is optimized below 2 minutes.

---

## 7. Verification Checklist

Use this checklist when reviewing the `sandbox` branch before merge:

- [ ] All 14 bug fix commits (`BUG-001` through `BUG-014`) are present and attributed
- [ ] Snapshot tests updated for all affected examples (check `example-snapshots.test.ts.snap`)
- [ ] No snapshot regressions for unaffected examples
- [ ] `sql-generator.ts` kind-checks include all 5 kinds: `Source`, `Transform`, `Window`, `Join`, `CEP`
- [ ] `schema-introspect.ts` kind-checks include all 5 kinds
- [ ] Connector truth table: PK × format × changelog mode combinations tested
- [ ] `resolvePartitionExpression` uses `BIGINT` for time-part functions
- [ ] `scan.startup.mode` preserved for changelog-format Kafka sources with PK
- [ ] VirtualRef injection consistent across `buildSiblingChainQuery`, `buildBranchQuery`, source nodes
- [ ] New examples 30–38 have both snapshot and EXPLAIN coverage
- [ ] Route branch examples (21, 23, 24, 25, 28) pass EXPLAIN
- [ ] Join schema resolution handles: regular join, interval join, temporal join, anti-join, semi-join, lookup join
