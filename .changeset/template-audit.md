---
"@flink-reactor/dsl": minor
---

Template audit & modernization — a deep-dive pass over the built-in scaffolder templates and the codegen defaults that shape their generated output.

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
