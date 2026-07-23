# Changelog

## 0.3.0

### Minor Changes

- d74c730: Add opt-in Prometheus + Grafana stack to the local cluster (`services.grafana: {}`). Grafana is themed with Gruvppuccin to match FlinkReactor Console and ships two auto-provisioned dashboards: **Flink Cluster Overview** and **pg-fluss-paimon Pipeline**. Both Prometheus (`localhost:9090`) and Grafana (`localhost:3000`) are surfaced via `cluster open <target>`. The Flink JM/TM `FLINK_PROPERTIES` now wire the Prometheus reporter on port 9249, and `Dockerfile.flink` activates the bundled reporter JAR on the runtime classpath.

  `fr new` learned a Grafana opt-in (interactive prompt + `--grafana` / `--no-grafana` flags), gated to Flink 2.x because the reporter wiring and dashboard PromQL are 2.x-only. Picking yes injects `services.grafana: {}` and the matching `metricsPlugin` registration into the rendered `flink-reactor.config.ts` — both pieces ship together so Prometheus actually sees Flink metrics. Default is off.

- d74c730: Template audit & modernization — a deep-dive pass over the built-in scaffolder templates and the codegen defaults that shape their generated output.

  **New template — `data-quality`** (`fr new -t data-quality`). A Kafka-only record-normalization pipeline that tours the field-transform components no other template exercised, verified end-to-end with a live Flink `EXPLAIN`:

  - `order-cleanup` — `<Cast safe>` (TRY_CAST dirty string columns), `<Coalesce>` (default missing values), `<Rename>` (canonical naming), `<AddField>` (audit timestamp), and `<Drop>` (PII scrub) chained in a single linear pipeline, plus production-grade `telemetry.labels`, `checkpoint`, and a blue-green `upgradeStrategy` (`FlinkBlueGreenDeployment`) for zero-downtime redeploys.

  **Codegen output changes** (may change generated CRDs for existing projects):

  - Flink container images are now **pinned to a patch version** — `FLINK_IMAGE_MAP` emits `flink:2.2.0` (was `flink:2.2`), and likewise for `1.20`/`2.0`/`2.1`. This restores deterministic output so committed CRDs no longer resolve a moving tag. Explicit `flinkImage` overrides are unaffected.
  - The **default Flink version** for projects that don't pin `flink.version` is now a single shared constant `DEFAULT_FLINK_VERSION = "2.2"` (matches the local cluster image). Previously `fr synth` defaulted to `2.0` while the config resolver and SQL/CRD codegen assumed `2.2`; config-less projects now get consistent 2.2 output throughout. Pin `flink.version` to opt out.

  **More correct examples:**

  - Windowed-aggregate `JdbcSink`s in `realtime-analytics`, `ecommerce`, `grocery-delivery`, and `banking` now carry `upsertMode` + a per-window `keyFields`, making them idempotent (exactly-once) across checkpoint recovery instead of appending duplicate rows on replay.
  - `telemetry.labels` added to the `cdc-lakehouse` and `banking` production pipelines.

  **Housekeeping:**

  - Removed the deprecated `defineEnvironment` usage from the `monorepo` template (now an inline `environments:` block) and deleted the dead `makeDevEnv` helper.
  - The interactive `fr new` picker now lists `lakehouse-ingestion`, `lakehouse-analytics`, and `data-quality` (previously reachable only via `-t`).
  - Rewrote the `create-fr-app` README to describe its actual behavior (the `@flink-reactor/ui` design-system scaffolder), corrected its `package.json` `files`/keywords, and fixed a stale `synthesizeApp` example in the template-conventions doc.

### Patch Changes

- d74c730: Escape single quotes in every generated SQL string literal. Connector `WITH` option keys and values, `SET` statements, `CREATE CATALOG` options, `CREATE FUNCTION ... AS '<class>'`, materialized-table `COMMENT` and table options, and side-output tag literals now route through shared `quoteStringLiteral` / `sqlOption` / `formatWithClause` helpers. A value — or user-provided option key — containing a `'` (passwords, connection strings, comments like `user's events`) no longer breaks out of its literal and emits malformed SQL.

  Connector `WITH`-clause keys are now emitted in canonical sorted order (Flink reads `WITH` as an unordered property bag), matching the existing tap-clause behaviour. This changes the byte order of generated `WITH` clauses — regenerate any committed SQL snapshots — but is otherwise semantically identical.

  Also: tapping a sibling-chain transform with no resolvable upstream connector now emits a clear, actionable diagnostic instead of "Tap is not supported for unknown connectors".

All notable changes to this project will be documented in this file.

This changelog is automatically maintained by [Changesets](https://github.com/changesets/changesets).
