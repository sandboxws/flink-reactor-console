<h1 align="center">FlinkReactor</h1>

<p align="center">
  <strong>Author Apache Flink pipelines as typed TypeScript components.<br />
  Compile them to standard Flink SQL and Kubernetes CRDs — deterministically, and with nothing to run at runtime.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flink-reactor/dsl"><img src="https://img.shields.io/npm/v/@flink-reactor/dsl?color=d97085&label=npm" alt="npm version" /></a>
  <a href="https://github.com/sandboxws/flink-reactor-dsl/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-BSL%201.1-blue" alt="license" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Flink-1.20%20%7C%202.0%20%7C%202.1%20%7C%202.2-e6526f" alt="Flink versions" />
  <img src="https://img.shields.io/badge/output-standard%20Flink%20SQL-brightgreen" alt="standard Flink SQL" />
  <a href="https://github.com/sandboxws/flink-reactor-dsl/stargazers"><img src="https://img.shields.io/github/stars/sandboxws/flink-reactor-dsl?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="https://flink-reactor.dev">Documentation</a> &middot;
  <a href="#-quick-start">Quick Start</a> &middot;
  <a href="#-why-typescript-not-a-wall-of-sql">Why TypeScript</a> &middot;
  <a href="#-built-for-teams-at-scale">Enterprise</a> &middot;
  <a href="#-examples">Examples</a>
</p>

<br />

## <img src="assets/icons/triangle-alert.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> The problem at scale

A handful of Flink jobs? Raw SQL and a few YAML files are fine.

Now run **120+ streaming jobs across dev, staging, and prod.** The bottleneck stops being Flink and becomes everything around it:

- Pipelines are **SQL in strings** — no type checker ever looks inside them. A renamed column surfaces as a 3 AM job failure, not a red squiggle in review.
- Every job ships **hand-written Kubernetes YAML** and a pile of connector JARs to track per Flink version.
- There's **no reuse.** The same windowed-aggregation pattern is copy-pasted across twenty jobs, and drifts in twenty directions.
- **Diffs are unreviewable** — a pull request is a wall of SQL text with no structure to reason about.
- **Nothing is testable** without a running cluster.
- Schemas **drift** between your registry and your pipeline definitions.
- Secrets get **pasted into connector options.**

Scaling Flink is a tooling problem before it's a Flink problem. FlinkReactor is that tooling.

<br />

## <img src="assets/icons/lightbulb.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> What FlinkReactor is

FlinkReactor is a **TypeScript DSL that synthesizes** Apache Flink SQL and Kubernetes `FlinkDeployment` CRDs from a typed component tree. You write the pipeline in TypeScript; `flink-reactor synth` compiles it to the exact SQL and YAML that Flink runs.

- **Nothing runs at runtime.** FlinkReactor is a build-time compiler. It emits **standard Flink SQL** — there is no FlinkReactor agent, dependency, or runtime inside your cluster, and no lock-in. Delete the tool tomorrow and your generated SQL still runs.
- **Deterministic.** The same input always produces **byte-identical** SQL and YAML, so generated artifacts are reviewable in a pull request and stable in CI.
- **Custom JSX, not React.** `createElement()` builds a construct **DAG**, not a virtual DOM. The JSX is compile-time sugar for the linear case; the model underneath is a directed acyclic graph, so fan-out, fan-in, and multi-sink topologies are first-class.

```
  Your pipeline (TypeScript)  ──▶  Construct DAG  ──▶  Flink SQL  +  FlinkDeployment CRD  ──▶  Flink Kubernetes Operator
      typed components            validate + wire       standard, deterministic output
```

> FlinkReactor is pre-1.0 (v0.2) and under active development. Generated SQL/CRD output is pinned by an extensive snapshot suite and the [invariant specs](docs/contributors/specs/) below, and drives the reproducible Postgres → Iceberg [benchmark tracks](#-reference-pipelines).

<br />

## <img src="assets/icons/play.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> See it in action

**8 lines of pipeline TSX** replace **33 lines of Flink SQL you'd otherwise write and maintain by hand** — with a typed, reusable schema instead of a copy-pasted column list.

<table>
<tr>
<th>With FlinkReactor</th>
<th>By hand — raw Flink SQL</th>
</tr>
<tr>
<td valign="top">

```tsx
// UserEventSchema defined once (or generated
// from your Schema Registry — see below)

export default (
  <Pipeline name="simple-source-sink" parallelism={4}>
    <KafkaSource
      topic="user_events"
      bootstrapServers="kafka:9092"
      schema={UserEventSchema}
    />
    <KafkaSink topic="user_events_processed" />
  </Pipeline>
);
```

</td>
<td valign="top">

```sql
CREATE TABLE `user_events` (
  `event_id` STRING,
  `user_id` STRING,
  `event_type` STRING,
  `payload` STRING,
  `event_time` TIMESTAMP(3)
) WITH (
  'connector' = 'kafka',
  'topic' = 'user_events',
  'properties.bootstrap.servers' = 'kafka:9092',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `user_events_processed` (
  `event_id` STRING,
  `user_id` STRING,
  `event_type` STRING,
  `payload` STRING,
  `event_time` TIMESTAMP(3)
) WITH (
  'connector' = 'kafka',
  'topic' = 'user_events_processed',
  'properties.bootstrap.servers' = 'kafka:9092',
  'format' = 'json'
);

INSERT INTO `user_events_processed`
SELECT * FROM `user_events`;
```

</td>
</tr>
</table>

Run `flink-reactor synth` and the DSL compiles that component tree into deterministic Flink SQL — every statement provenance-tagged and emitted in a stable order — **plus** a Kubernetes `FlinkDeployment` CRD ready for `kubectl apply`:

```sql
-- ====================================================================
-- SOURCE TABLE
-- --------------------------------------------------------------------
-- id : user_events   type : kafka   format : json   startup : earliest-offset
-- ====================================================================

CREATE TABLE `user_events` ( ... ) WITH (
  'connector' = 'kafka',
  'format' = 'json',
  'properties.bootstrap.servers' = 'kafka:9092',
  'scan.startup.mode' = 'earliest-offset',   -- options emitted in a stable, sorted order
  'topic' = 'user_events'
);
```

The banners and deterministic ordering aren't cosmetic — they're what make the generated SQL **diff-reviewable** and byte-stable across machines and CI.

<br />

## <img src="assets/icons/sparkles.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Why TypeScript, not a wall of SQL

The point isn't that TypeScript is prettier than SQL. It's that a **string of SQL is opaque to every tool you own**, and a typed pipeline is not. FlinkReactor gives you back the entire toolchain that raw Flink SQL leaves on the table:

| Writing raw Flink SQL | Writing FlinkReactor |
| --- | --- |
| SQL lives in strings — no type checker ever looks inside | Schemas are real TypeScript types; columns, shapes, and connector props are checked **as you type** |
| Mistakes surface when the job fails on the cluster | The language server flags unknown columns, malformed expressions, missing connector props, changelog/sink mismatches, and DAG errors **inline, before you run anything** |
| Copy-paste a pattern to reuse it | `import` a typed, parameterized pipeline and call it |
| Review is a line-by-line read of SQL text | The DSL is the reviewable source; generated SQL/YAML is deterministic and diffs cleanly |
| No tests without a running cluster | Snapshot- and assertion-test generated SQL in CI — **no cluster required** |
| Write the Kubernetes YAML yourself | The `FlinkDeployment` CRD is generated alongside the SQL |

### Author-time intelligence, backed by real synthesis

FlinkReactor ships a [language server](packages/language-server/) and a [VS Code extension](packages/vscode-extension/) that don't guess — they run your pipeline through the **actual synthesis pipeline** in an isolated worker and map the generated SQL back to your source. That makes possible things a SQL editor structurally cannot do, because the SQL doesn't exist until your TypeScript compiles:

- **Diagnostics keyed to the exact node**, with stable `FR-` codes that read identically in VS Code, IntelliJ, or Neovim:

  | Code | Catches |
  | --- | --- |
  | `FR-SCHEMA-001` | Unknown column reference — with a *did-you-mean* from the upstream schema |
  | `FR-EXPR-001` | Malformed SQL in a `Filter` / `Map` / `Aggregate` / `Query` prop, narrowed to the prop value |
  | `FR-CONN-001` | Missing required or conditional connector property |
  | `FR-CDC-001` | A retract/upsert source feeding an append-only sink — cross-node, sink→source linked |
  | `FR-DAG-001` | Orphan source, dangling sink, or cycle |

- **Bidirectional SQL preview** — put the caret on a `<Filter>` and it highlights the exact `WHERE` byte-span it generated; click a span of SQL and it jumps back to the node that authored it.
- **Hover & inlay hints** show each node's inferred output schema, its changelog mode (`append` / `retract` / `upsert`), effective parallelism, and the SQL fragment it emits — read straight from synthesis, inline.
- **Go-to-definition across references** — Cmd-click a column in `condition="user_id > 0"` and land on its `Schema({ fields })` declaration, even across `schemas/*.ts` files.
- **A clean two-server split, no overlap:** `tsserver` + [`@flink-reactor/ts-plugin`](packages/ts-plugin/) owns JSX-nesting validity and type errors; `@flink-reactor/language-server` owns every `FR`-coded synthesis diagnostic.
- **Optional deep validation** — submit the synthesized SQL to a live Flink SQL Gateway via `EXPLAIN` (`--deep-validate`, or the editor command) so planner-level errors — a missing catalog table, a live type mismatch, an unregistered UDF — land on the JSX that produced them. Off by default; nothing connects until you opt in.

<br />

## <img src="assets/icons/shield.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Built for teams at scale

The features that matter at 5 jobs are table stakes. These are the ones that matter at 500.

### Deterministic, auditable output

- **Byte-identical synthesis.** The same input always produces the same SQL and YAML — so generated artifacts are reviewable in a PR and never spuriously churn CI.
- **Behavior pinned by contract.** The core subsystems' rules live as [invariant specs](docs/contributors/specs/) with **stable, append-only IDs** — `ORD-` (statement ordering), `CLM-` (changelog propagation), `NID-` (node-id determinism), `TAP-` (tap resolution). Each invariant names the test that enforces it; the spec is canonical, code implements it, tests hold the line across refactors.
- **Machine-readable reports.** `synth --json` and `validate --json` emit versioned output for CI gates and dashboards.
- **Validation in depth.** `flink-reactor validate` runs DAG checks (orphans, dangling sinks, cycles), Flink-version feature gates, schema references, SQL-expression parsing, connector-property rules, and secret-hygiene lint — with optional `--deep-validate` against a live SQL Gateway.

### Kubernetes-native, air-gap-ready

- **`FlinkDeployment` CRDs** for the Flink Kubernetes Operator, generated with the SQL — including blue-green deployments and a `savepoint` / `resume` / `stop` / `status` lifecycle.
- **Connector-JAR delivery you control** — `init-container` or `custom-image` strategies, with a **Maven mirror for air-gapped environments**, a private `imageRegistry`, and `imagePullSecret`. Locked-down clusters are a first-class target, not an afterthought.

### Schema-registry typing & secret hygiene

- **Generate types from your source of truth.** `flink-reactor schema generate` introspects **Confluent Schema Registry / Karapace** (Avro, JSON Schema, Protobuf) and live **Postgres**, and writes typed `schemas/*.ts` — so your pipeline types can't silently drift from the registry.
- **Secrets never enter your source.** Passwords are typed as `SecretRef`, so **a plaintext credential is a compile error**; the DSL emits `${env:...}` placeholders and Kubernetes `secretKeyRef` env, and redacts sensitive options on every display surface.

### Multi-environment & CI/CD

- **`defineConfig` / `defineEnvironment`** model dev/staging/prod with per-environment overrides that can even subtract services.
- **CI-friendly by construction** — deterministic diffs, exit-code gating, `--json` reports, and an end-to-end suite that packs the published artifact and runs the CLI as a subprocess.

<br />

## <img src="assets/icons/rocket.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Quick Start

```bash
# Scaffold a new pipeline project (interactive: template, Flink version, package manager)
npx @flink-reactor/dsl new my-pipeline
cd my-pipeline

# Synthesize Flink SQL + Kubernetes CRDs from your pipeline
pnpm flink-reactor synth

# Validate the topology (no orphans, no cycles, changelog-compatible sinks)
pnpm flink-reactor validate

# Visualize the DAG, or develop with hot-reload
pnpm flink-reactor graph
pnpm flink-reactor dev
```

> **Heads up:** the pipeline scaffolder is `flink-reactor new`. The separate [`create-fr-app`](packages/create-fr-app/) package scaffolds a Next.js UI app on the `@flink-reactor/ui` design system — not Flink pipelines.

### Try it end-to-end, locally

FlinkReactor bundles a full local stack so you can evaluate against real infrastructure:

```bash
flink-reactor cluster up     # Flink + Kafka + Karapace registry + Postgres + Iceberg + Fluss + Prometheus + Grafana (Docker)
flink-reactor cluster seed   # submit example pipelines and publish CDC data
# or, on Kubernetes:
flink-reactor sim up         # minikube + Flink Kubernetes Operator + the same infra
```

<br />

## <img src="assets/icons/workflow.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Components & CLI

### Component vocabulary

| Group | Components |
| --- | --- |
| **Sources** | `KafkaSource`, `JdbcSource`, `FlussSource`, `PostgresCdcPipelineSource`, `DataGenSource`, `CatalogSource`, `GenericSource` |
| **Sinks** | `KafkaSink`, `JdbcSink`, `IcebergSink`, `PaimonSink`, `FlussSink`, `FileSystemSink`, `GenericSink` |
| **Transforms** | `Filter`, `Map`, `FlatMap`, `Aggregate`, `Union`, `Deduplicate`, `TopN` |
| **Field transforms** | `AddField`, `Cast`, `Coalesce`, `Drop`, `Rename` — column-level schema evolution |
| **Joins** | `Join`, `IntervalJoin`, `LookupJoin`, `TemporalJoin`, `BroadcastJoin`, `LateralJoin` |
| **Windows** | `TumbleWindow`, `SlideWindow`, `SessionWindow` — TVF-based windowing |
| **Catalogs** | `IcebergCatalog`, `PaimonCatalog`, `FlussCatalog`, `HiveCatalog`, `JdbcCatalog`, `GenericCatalog` |
| **Routing & fan-out** | `Route` (`Route.Branch` / `Route.Default`), `SideOutput` |
| **Query & CEP** | `Query` (`Select`/`Where`/`GroupBy`/`Having`/`OrderBy`, OVER windows), `MatchRecognize` |
| **Data quality** | `Validate`, `Qualify` — in-stream assertions |
| **Escape hatches** | `RawSQL`, `UDF` — drop to raw Flink SQL when you need to |

### CLI

| Command | Description |
| --- | --- |
| `flink-reactor new` | Scaffold a new pipeline project (interactive) |
| `flink-reactor synth` | Synthesize pipelines to Flink SQL + CRDs (`--json`, `--deep-validate`) |
| `flink-reactor validate` | Validate topology, schemas, connectors, secrets, version gates |
| `flink-reactor graph` | Visualize the pipeline DAG (`ascii` / `dot` / `svg`) |
| `flink-reactor schema generate` | Generate typed schemas from a registry or live Postgres |
| `flink-reactor dev` | Watch mode with hot-reload |
| `flink-reactor deploy` | Deploy pipelines for the current environment |
| `flink-reactor cluster` / `sim` | Local Flink stack via Docker Compose / minikube |
| `flink-reactor stop` · `resume` · `savepoint` · `status` | Job lifecycle against a live cluster |
| `flink-reactor doctor` | Diagnose your environment (Java, Docker, kubectl, Flink) |

<br />

## <img src="assets/icons/code-xml.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Examples

FlinkReactor ships **34 worked examples** in [`src/examples/`](src/examples/), each a `before.sql` (hand-written target) / `after.tsx` (the DSL equivalent) pair — a ready-made "migrate raw Flink SQL to typed pipelines" reference spanning windows, every join strategy, CEP, CDC, lambda architecture, top-N, and schema evolution.

### Windowed aggregation — nesting as topology

> [`04-tumble-window`](src/examples/04-tumble-window/after.tsx) — a tumble window wrapping an aggregate, then a filter and sink

```tsx
export default (
  <Pipeline name="active-users-per-minute" parallelism={12}>
    <KafkaSource topic="clickstream" bootstrapServers="kafka:9092" schema={ClickstreamSchema} />
    <TumbleWindow size="1 minute" on="event_time">
      <Aggregate
        groupBy={["user_id"]}
        select={{
          user_id: "user_id",
          page_views: "COUNT(*)",
          unique_pages: "COUNT(DISTINCT page_url)",
        }}
      />
    </TumbleWindow>
    <Filter condition="page_views > 5" />
    <KafkaSink topic="active_users_per_minute" />
  </Pipeline>
);
```

### Conditional fan-out — one source, many sinks

> [`24-lambda-architecture`](src/examples/24-lambda-architecture/after.tsx) — `Route` fans a clickstream into a data-lake archive, real-time metrics, an upsert, and alerts

```tsx
<Route>
  <Route.Branch condition="true">
    <FileSystemSink path="s3://data-lake/clickstream/raw/" format="parquet"
      partitionBy={["DATE(event_time)", "HOUR(event_time)"]} />
  </Route.Branch>
  <Route.Branch condition="true">
    <TumbleWindow size="1 minute" on="event_time">
      <Aggregate groupBy={["page_url"]} select={{ page_url: "page_url", view_count: "COUNT(*)" }} />
    </TumbleWindow>
    <KafkaSink topic="realtime_page_metrics" />
  </Route.Branch>
  <Route.Branch condition="event_type IN ('error', 'exception')">
    <KafkaSink topic="error_events_alerts" />
  </Route.Branch>
</Route>
```

Other highlights: [`06-interval-join`](src/examples/06-interval-join/after.tsx) (two-stream time-bounded join), [`15-cep-fraud-detection`](src/examples/15-cep-fraud-detection/after.tsx) (`MATCH_RECOGNIZE` pattern matching), [`26-cdc-sync`](src/examples/26-cdc-sync/after.tsx) (change-data-capture), and [`16-temporal-join`](src/examples/16-temporal-join/after.tsx).

<br />

## <img src="assets/icons/git-branch.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Reference pipelines

Production-shaped pipeline templates that ship in-tree. Copy a directory into your own project as a starting point — they're also the tracks behind the Postgres → Iceberg CDC benchmark, so any number the benchmark publishes is reproducible from the same source.

- [`pipelines/pg-cdc-iceberg-f1/`](pipelines/pg-cdc-iceberg-f1/) — **F1 (Kafka-hop):** Postgres → Debezium → Kafka → Flink SQL → Iceberg. Parameterized on `wireFormat` (`json` / `avro` / `protobuf`) and `commitMode` (`throughput` / `latency`).
- [`pipelines/pg-cdc-iceberg-f2/`](pipelines/pg-cdc-iceberg-f2/) — **F2 (Pipeline Connector):** Postgres → Flink CDC 3.6 Pipeline Connector → Iceberg. No Kafka hop. Parameterized on `snapshotMode` and `commitMode`.
- [`pipelines/pg-fluss-paimon/`](pipelines/pg-fluss-paimon/) — **Streaming OLAP via shared Fluss storage:** Postgres → Fluss primary-key table → Flink SQL → Paimon. Two coupled entry points (`ingest.tsx` + `serve.tsx`) tied by a shared Fluss table — one CDC ingest job, any number of serve-side fan-out jobs.

The first two write to a Lakekeeper REST Iceberg catalog with Merge-on-Read (equality-field columns, `zstd` Parquet, hash distribution), so downstream Iceberg queries see equivalent tables regardless of which pipeline produced them.

<br />

## <img src="assets/icons/layers.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Architecture

```
┌───────────────────────────────────────────────┐
│                Your Pipeline                  │
│         (TypeScript + JSX components)         │
└───────────────────────┬───────────────────────┘
                        │ flink-reactor synth
                        ▼
┌───────────────────────────────────────────────┐
│              Construct DAG                     │
│   Sources → Transforms → Joins → Sinks        │
│   topology validation · wiring · changelog    │
└───────────┬───────────────────────┬───────────┘
            ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────┐
│    SQL Generator    │  │      CRD Generator      │
│  CREATE TABLE / …   │  │   FlinkDeployment YAML  │
│  INSERT INTO …      │  │   + connector JARs      │
└─────────────────────┘  └─────────────────────────┘
            └───────────┬───────────┘
                        ▼
┌───────────────────────────────────────────────┐
│           Flink Kubernetes Operator           │
└───────────────────────────────────────────────┘
```

### Design principles

- **Synthesis only** — no runtime code executes inside Flink. We generate SQL and YAML.
- **Custom JSX, not React** — `createElement()` builds a construct tree, not a virtual DOM.
- **DAG, not tree** — pipelines are directed acyclic graphs; JSX nesting is sugar for the linear case.
- **Deterministic output** — same input always produces the same SQL and YAML.
- **Flink SQL is the target** — every component compiles to Flink SQL. No DataStream API (yet).

`FlinkVersionCompat` handles the differences between Flink versions (config-key renames, JDBC connector structure) automatically, and **rejects version-incompatible features at author time** — a `VECTOR_SEARCH` TVF on Flink 2.1, for instance, is flagged before you deploy, not after.

<br />

## <img src="assets/icons/folder-tree.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Packages & related repositories

```
flink-reactor-dsl/
├── src/                      # Core DSL engine, components, codegen, CLI, testing
├── packages/
│   ├── language-server/      # LSP backend — synthesis-backed diagnostics, hover, navigation
│   ├── ts-plugin/            # TypeScript language-service plugin — JSX nesting + completions
│   ├── vscode-extension/     # VS Code client — live diagnostics, SQL/CRD preview, DAG, schema explorer
│   └── create-fr-app/        # Next.js UI-app scaffolder (@flink-reactor/ui design system)
├── pipelines/                # Production-shaped reference pipelines
└── docs/contributors/specs/  # Behavioral invariant specs (ORD / CLM / NID / TAP)
```

| Package | What it does | License |
| --- | --- | --- |
| [`@flink-reactor/dsl`](https://www.npmjs.com/package/@flink-reactor/dsl) | Core DSL engine, components, codegen, and the `flink-reactor` CLI | BSL 1.1 |
| [`@flink-reactor/language-server`](packages/language-server/) | Editor-agnostic LSP backend (synthesis-backed) | BSL 1.1 |
| [`@flink-reactor/ts-plugin`](packages/ts-plugin/) | TypeScript language-service plugin | BSL 1.1 |
| [FlinkReactor for VS Code](packages/vscode-extension/) | The VS Code client shell | BSL 1.1 |
| [`@flink-reactor/create-fr-app`](packages/create-fr-app/) | Next.js UI-app scaffolder (design system) | BSL 1.1 |

FlinkReactor is one half of a pair: **the DSL solves authorship; the [FlinkReactor Console](https://github.com/sandboxws/flink-reactor-platform) solves operations** — the back-pressure, multi-cluster, 3-AM-visibility side of running Flink. They're independent but designed to complement each other.

<br />

## <img src="assets/icons/heart-handshake.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Contributing

Bug reports, feature ideas, and PRs are all welcome. See the **[Contributing Guide](CONTRIBUTING.md)** for setup, workflow, and the release process.

- **Report bugs** — [open an issue](https://github.com/sandboxws/flink-reactor-dsl/issues/new)
- **Suggest features** — [start a discussion](https://github.com/sandboxws/flink-reactor-dsl/issues)
- **Submit PRs** — we use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`). Changes to statement ordering, changelog propagation, node-id assignment, or tap behavior must cite the relevant [invariant spec](docs/contributors/specs/) ID.

<br />

## <img src="assets/icons/scale.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> License

FlinkReactor is licensed under the **[Business Source License 1.1](LICENSE)**.

- **Internal production use is always free** — use FlinkReactor to build and run your own pipelines, at any scale, without restriction.
- **A commercial license is required** only to offer FlinkReactor (or a derivative) to third parties as a managed service, hosted platform, or API.
- **Converts to [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) on 2030-03-10** — after the change date, this version becomes fully open source.

For commercial-licensing inquiries, see [flink-reactor-platform](https://github.com/sandboxws/flink-reactor-platform).
