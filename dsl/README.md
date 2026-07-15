<h1 align="center">FlinkReactor</h1>

<p align="center">
  <strong>Author Apache Flink pipelines as typed TypeScript components.<br />
  Compile them to standard Flink SQL and Kubernetes CRDs. Deterministic output, and nothing to run at runtime.</strong>
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
  <code>npx @flink-reactor/dsl new my-pipeline</code>
</p>

<br />

| Jump to | |
| --- | --- |
| **[What it is](#-what-it-is)** | TypeScript in. Flink SQL and Kubernetes CRDs out. |
| **[See it in action](#-see-it-in-action)** | 8 lines of JSX, and the real artifacts they compile to |
| **[Quick start](#-quick-start)** | Scaffold a project, synthesize it, run a local stack |
| **[Why not raw SQL](#-why-not-raw-sql)** | What breaks once you pass ~100 jobs |
| **[Author-time tooling](#-author-time-tooling)** | Diagnostics keyed to the node that caused them |
| **[At scale](#-at-scale)** | Auditability, Kubernetes, schema registries, secrets |
| **[Components & CLI](#-components--cli)** | The full component vocabulary and every command |
| **[Examples](#-examples)** | 34 worked "raw SQL → typed pipeline" conversions |
| **[Reference pipelines](#-reference-pipelines)** | Production-shaped templates you can copy |
| **[Architecture](#-architecture)** | How synthesis works, and the rules it follows |
| **[Packages](#-packages)** | What ships, and where the deeper docs live |
| **[Documentation](https://flink-reactor.dev)** | flink-reactor.dev |

<br />

## <img src="assets/icons/lightbulb.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> What it is

FlinkReactor is a **TypeScript DSL that synthesizes** Apache Flink SQL and Kubernetes `FlinkDeployment` CRDs from a typed component tree. You write the pipeline in TypeScript; `flink-reactor synth` compiles it to the exact SQL and YAML that Flink runs.

```
  Your pipeline (TypeScript)  ──▶  Construct DAG  ──▶  Flink SQL  +  FlinkDeployment CRD  ──▶  Flink Kubernetes Operator
      typed components            validate + wire       standard, deterministic output
```

- **Nothing runs at runtime.** FlinkReactor is a build-time compiler that emits **standard Flink SQL**. There is no FlinkReactor agent, dependency, or runtime inside your cluster, and no lock-in. Delete the tool tomorrow and your generated SQL still runs.
- **Deterministic.** The same input always produces **byte-identical** SQL and YAML, so generated artifacts are reviewable in a pull request and stable in CI.
- **A DAG, not a tree.** `createElement()` builds a construct graph, not a virtual DOM. This is custom JSX, not React: nesting is compile-time sugar for the linear case, and fan-out, fan-in, and multi-sink topologies are first-class.

> FlinkReactor is pre-1.0 (v0.2) and under active development. Generated output is pinned by an extensive snapshot suite and the [invariant specs](docs/contributors/specs/), and drives the reproducible Postgres → Iceberg [benchmark tracks](#-reference-pipelines).

<br />

## <img src="assets/icons/play.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> See it in action

**8 lines of JSX** replace **33 lines of Flink SQL** you'd otherwise write and maintain by hand, with a typed, reusable schema instead of a copy-pasted column list.

<table>
<tr>
<th>With FlinkReactor</th>
<th>By hand: raw Flink SQL</th>
</tr>
<tr>
<td valign="top">

```tsx
// UserEventSchema is defined once, or generated
// from your Schema Registry (see below)

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
-- Simple Source to Sink
-- A basic Kafka passthrough pipeline that reads user events
-- and writes them to a processed topic.

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
  'scan.startup.mode' = 'earliest-offset'
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

### What `synth` writes

Run `flink-reactor synth` and the DSL compiles that component tree into both halves of a deployable job:

```
dist/
├── simple-source-sink/
│   ├── pipeline.sql          # 9 statements, provenance-tagged, in a stable order
│   ├── deployment.yaml       # the FlinkDeployment CRD, ready for kubectl apply
│   └── configmap.yaml        # the same SQL as a ConfigMap for the operator to mount
└── simple-source-sink.tap-manifest.json
```

`deployment.yaml` is the CRD the [Flink Kubernetes Operator](https://nightlies.apache.org/flink/flink-kubernetes-operator-docs-stable/) consumes:

```yaml
apiVersion: flink.apache.org/v1beta1
kind: FlinkDeployment
metadata:
  name: simple-source-sink
spec:
  image: flink:2.2.0
  flinkVersion: v2_2
  flinkConfiguration:
    execution.runtime-mode: STREAMING
    pipeline.global-job-parameters: pipeline.sql.b64:LS0gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09…
  jobManager:
    resource:
      cpu: '1'
      memory: 1024m
    replicas: 1
  taskManager:
    resource:
      cpu: '1'
      memory: 1024m
  job:
    jarURI: local:///opt/flink/usrlib/sql-runner.jar
    parallelism: 4
```

*Only the `pipeline.sql.b64` value is truncated above. `synth` writes the whole of `pipeline.sql` there, base64-encoded, so the running job's SQL round-trips back through the operator.*

<details>
<summary><b>The generated <code>pipeline.sql</code></b> (verbatim, 68 lines)</summary>

```sql
-- ====================================================================
-- PIPELINE
-- --------------------------------------------------------------------
-- name        : simple-source-sink
-- parallelism : 4
-- ====================================================================

SET 'pipeline.name' = 'simple-source-sink';

SET 'parallelism.default' = '4';

-- ====================================================================
-- SOURCE TABLE
-- --------------------------------------------------------------------
-- id          : user_events
-- type        : kafka
-- topic       : user_events
-- format      : json
-- bootstrap   : kafka:9092
-- startup     : earliest-offset
-- ====================================================================

CREATE TABLE `user_events` (
  `event_id` STRING,
  `user_id` STRING,
  `event_type` STRING,
  `payload` STRING,
  `event_time` TIMESTAMP(3)
) WITH (
  'connector' = 'kafka',
  'format' = 'json',
  'properties.bootstrap.servers' = 'kafka:9092',
  'scan.startup.mode' = 'earliest-offset',
  'topic' = 'user_events'
);

-- ====================================================================
-- SINK TABLE
-- --------------------------------------------------------------------
-- id          : user_events_processed
-- type        : kafka
-- topic       : user_events_processed
-- format      : json
-- bootstrap   : kafka:9092
-- ====================================================================

CREATE TABLE `user_events_processed` (
  `event_id` STRING,
  `user_id` STRING,
  `event_type` STRING,
  `payload` STRING,
  `event_time` TIMESTAMP(3)
) WITH (
  'connector' = 'kafka',
  'format' = 'json',
  'properties.bootstrap.servers' = 'kafka:9092',
  'topic' = 'user_events_processed'
);

-- ====================================================================
-- TRANSFORMATION
-- --------------------------------------------------------------------
-- input       : user_events
-- output      : user_events_processed
-- ====================================================================

INSERT INTO `user_events_processed`
SELECT * FROM `user_events`;
```

</details>

Every statement carries a provenance banner, and connector options are emitted in sorted order. Both are what make the generated SQL diff-reviewable in a pull request and byte-stable across machines and CI.

<br />

## <img src="assets/icons/rocket.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Quick start

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

> **Heads up:** the pipeline scaffolder is `flink-reactor new`. The separate [`create-fr-app`](packages/create-fr-app/) package scaffolds a Next.js UI app on the `@flink-reactor/ui` design system, not Flink pipelines.

### Try it end-to-end, locally

FlinkReactor bundles a full local stack so you can evaluate against real infrastructure:

```bash
flink-reactor cluster up     # Flink + Kafka + Karapace registry + Postgres + Iceberg + Fluss + Prometheus + Grafana (Docker)
flink-reactor cluster seed   # submit example pipelines and publish CDC data
# or, on Kubernetes:
flink-reactor sim up         # minikube + Flink Kubernetes Operator + the same infra
```

<br />

## <img src="assets/icons/triangle-alert.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Why not raw SQL

A handful of Flink jobs? Raw SQL and a few YAML files are fine.

Now run **120+ streaming jobs across dev, staging, and prod.** The bottleneck stops being Flink and becomes authorship, review, and governance, because a string of SQL is opaque to every tool you own.

| Writing raw Flink SQL | Writing FlinkReactor |
| --- | --- |
| SQL lives in strings. A renamed column surfaces as a 3 AM job failure, not a red squiggle in review. | Schemas are TypeScript types. Columns and connector props are checked **as you type**. |
| Mistakes surface when the job fails on the cluster | Unknown columns, bad expressions, missing props, changelog/sink mismatches, and DAG errors land **inline, before you run anything** |
| Copy-paste a pattern, then watch twenty copies drift in twenty directions | `import` a typed, parameterized pipeline and call it |
| Review is a wall of SQL text with no structure to reason about | The DSL is the reviewable source. Generated output is deterministic and diffs cleanly |
| No tests without a running cluster | Snapshot- and assertion-test the generated SQL in CI, no cluster required |
| Write the Kubernetes YAML yourself, and track connector JARs per Flink version | The `FlinkDeployment` CRD is generated alongside the SQL, JAR delivery included |
| Schemas drift between your registry and your pipeline definitions | `schema generate` types your pipeline from the registry itself |
| Secrets get pasted into connector options | Passwords are typed as `SecretRef`, so a plaintext credential is a **compile error** |

<br />

## <img src="assets/icons/sparkles.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Author-time tooling

The [language server](packages/language-server/) and [VS Code extension](packages/vscode-extension/) don't guess. They run your pipeline through the **actual synthesis path** in an isolated worker, then map the generated SQL back to your source. A SQL editor structurally can't do this: the SQL doesn't exist until your TypeScript compiles.

**Diagnostics keyed to the exact node**, with stable `FR-` codes that read identically in VS Code, IntelliJ, or Neovim:

| Code | Catches |
| --- | --- |
| `FR-SCHEMA-001` | Unknown column reference, with a *did-you-mean* from the upstream schema |
| `FR-EXPR-001` | Malformed SQL in a `Filter` / `Map` / `Aggregate` / `Query` prop, narrowed to the prop value |
| `FR-CONN-001` | Missing required or conditional connector property |
| `FR-CDC-001` | A retract/upsert source feeding an append-only sink, linked from sink back to source |
| `FR-DAG-001` | Orphan source, dangling sink, or cycle |

- **Bidirectional SQL preview.** Put the caret on a `<Filter>` and it highlights the exact `WHERE` byte-span it generated. Click a span of SQL and it jumps back to the node that authored it.
- **Hover and inlay hints** show each node's inferred schema, changelog mode (`append` / `retract` / `upsert`), effective parallelism, and emitted SQL, read straight from synthesis.
- **Go-to-definition across references.** Cmd-click a column in `condition="user_id > 0"` and land on its `Schema({ fields })` declaration, even across `schemas/*.ts` files.
- **Optional deep validation.** `--deep-validate` submits the synthesized SQL to a live Flink SQL Gateway via `EXPLAIN`, so planner-level errors (a missing catalog table, a live type mismatch, an unregistered UDF) land on the JSX that produced them. Off by default; nothing connects until you opt in.

Both READMEs cover the rest, including the two-server split with `tsserver`.

<br />

## <img src="assets/icons/shield.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> At scale

The features that matter at 5 jobs are table stakes. These are the ones that matter at 500.

**Auditable by contract.** The core subsystems' rules live as [invariant specs](docs/contributors/specs/) with stable, append-only IDs: `ORD-` (statement ordering), `CLM-` (changelog propagation), `NID-` (node-id determinism), `TAP-` (tap resolution). Each names the test that enforces it, so the spec stays canonical across refactors. `synth --json` and `validate --json` emit versioned reports for CI gates.

**Kubernetes-native, air-gap-ready.** `FlinkDeployment` CRDs for the Flink Kubernetes Operator, generated with the SQL, including blue-green deploys and a `savepoint` / `resume` / `stop` / `status` lifecycle. Connector-JAR delivery is yours to control via `init-container` or `custom-image`, with a **Maven mirror for air-gapped environments**, a private `imageRegistry`, and `imagePullSecret`. Locked-down clusters are a first-class target, not an afterthought.

**Typed from your source of truth.** `flink-reactor schema generate` introspects **Confluent Schema Registry / Karapace** (Avro, JSON Schema, Protobuf) and live **Postgres**, then writes typed `schemas/*.ts`, so your pipeline types can't silently drift from the registry.

**Secrets never enter your source.** Passwords are typed as `SecretRef`, so **a plaintext credential is a compile error**. The DSL emits `${env:...}` placeholders and Kubernetes `secretKeyRef` env, and redacts sensitive options on every display surface.

**Multi-environment and CI/CD.** `defineConfig` / `defineEnvironment` model dev/staging/prod with per-environment overrides that can even subtract services. `flink-reactor validate` covers DAG checks (orphans, dangling sinks, cycles), version feature gates, schema references, SQL-expression parsing, connector-property rules, and secret-hygiene lint.

<br />

## <img src="assets/icons/workflow.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Components & CLI

<details>
<summary><b>Component vocabulary</b>: sources, sinks, transforms, joins, windows, catalogs, routing, CEP</summary>

| Group | Components |
| --- | --- |
| **Sources** | `KafkaSource`, `JdbcSource`, `FlussSource`, `PostgresCdcPipelineSource`, `DataGenSource`, `CatalogSource`, `GenericSource` |
| **Sinks** | `KafkaSink`, `JdbcSink`, `IcebergSink`, `PaimonSink`, `FlussSink`, `FileSystemSink`, `GenericSink` |
| **Transforms** | `Filter`, `Map`, `FlatMap`, `Aggregate`, `Union`, `Deduplicate`, `TopN` |
| **Field transforms** | `AddField`, `Cast`, `Coalesce`, `Drop`, `Rename` for column-level schema evolution |
| **Joins** | `Join`, `IntervalJoin`, `LookupJoin`, `TemporalJoin`, `BroadcastJoin`, `LateralJoin` |
| **Windows** | `TumbleWindow`, `SlideWindow`, `SessionWindow` (TVF-based) |
| **Catalogs** | `IcebergCatalog`, `PaimonCatalog`, `FlussCatalog`, `HiveCatalog`, `JdbcCatalog`, `GenericCatalog` |
| **Routing & fan-out** | `Route` (`Route.Branch` / `Route.Default`), `SideOutput` |
| **Query & CEP** | `Query` (`Select`/`Where`/`GroupBy`/`Having`/`OrderBy`, OVER windows), `MatchRecognize` |
| **Data quality** | `Validate`, `Qualify` for in-stream assertions |
| **Escape hatches** | `RawSQL`, `UDF`, to drop to raw Flink SQL when you need to |

</details>

<details>
<summary><b>CLI</b>: every command</summary>

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

</details>

<br />

## <img src="assets/icons/code-xml.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Examples

FlinkReactor ships **34 worked examples** in [`src/examples/`](src/examples/), nearly all a `before.sql` (hand-written target) and `after.tsx` (the DSL equivalent) pair. Together they're a ready-made "migrate raw Flink SQL to typed pipelines" reference spanning windows, every join strategy, CEP, CDC, lambda architecture, top-N, and schema evolution.

### Conditional fan-out: one source, many sinks

> [`24-lambda-architecture`](src/examples/24-lambda-architecture/after.tsx) uses `Route` to fan a clickstream into a data-lake archive, real-time metrics, and alerts. This is the DAG underneath, which JSX nesting alone can't express.

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

<details>
<summary><b>Windowed aggregation</b>: nesting as topology</summary>

> [`04-tumble-window`](src/examples/04-tumble-window/after.tsx) wraps an aggregate in a tumble window, then filters and sinks.

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

</details>

Other highlights: [`06-interval-join`](src/examples/06-interval-join/after.tsx) (two-stream time-bounded join), [`15-cep-fraud-detection`](src/examples/15-cep-fraud-detection/after.tsx) (`MATCH_RECOGNIZE` pattern matching), [`26-cdc-sync`](src/examples/26-cdc-sync/after.tsx) (change-data-capture), and [`16-temporal-join`](src/examples/16-temporal-join/after.tsx).

<br />

## <img src="assets/icons/git-branch.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Reference pipelines

Production-shaped templates that ship in-tree. Copy one into your project as a starting point. They're also the tracks behind the Postgres → Iceberg CDC benchmark, so any number it publishes is reproducible from source.

| Track | Shape | Parameterized on |
| --- | --- | --- |
| **F1 (Kafka-hop)** <br /> [`pg-cdc-iceberg-f1`](pipelines/pg-cdc-iceberg-f1/README.md) | Postgres → Debezium → Kafka → Flink SQL → Iceberg | `wireFormat` (`json` / `avro` / `protobuf`), `commitMode` (`throughput` / `latency`) |
| **F2 (Pipeline Connector)** <br /> [`pg-cdc-iceberg-f2`](pipelines/pg-cdc-iceberg-f2/README.md) | Postgres → Flink CDC 3.6 Pipeline Connector → Iceberg, no Kafka hop | `snapshotMode`, `commitMode` |
| **Streaming OLAP** <br /> [`pg-fluss-paimon`](pipelines/pg-fluss-paimon/README.md) | Postgres → Fluss primary-key table → Flink SQL → Paimon. Two entry points (`ingest.tsx` + `serve.tsx`) share a Fluss table: one ingest job, any number of serve-side fan-outs | `paimonMergeEngine` (`deduplicate` / `partial-update`), `commitMode` |

F1 and F2 both write to a Lakekeeper REST Iceberg catalog with Merge-on-Read, so downstream queries see equivalent tables either way.

<br />

## <img src="assets/icons/layers.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Architecture

Synthesis is a compiler pass. Your component tree is resolved into a construct DAG, validated, then handed to two independent generators whose outputs are designed to be read by humans in a pull request.

<details>
<summary><b>The synthesis pipeline</b>, end to end</summary>

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

</details>

Two rules constrain everything above, beyond the [determinism and synthesis-only guarantees](#-what-it-is):

- **Flink SQL is the target.** Every component compiles to Flink SQL. No DataStream API (yet).
- **Version differences are handled, not deferred.** `FlinkVersionCompat` absorbs config-key renames and JDBC connector restructuring across Flink versions, and **rejects version-incompatible features at author time**. A `VECTOR_SEARCH` TVF on Flink 2.1, for instance, is flagged before you deploy rather than after.

<br />

## <img src="assets/icons/folder-tree.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Packages

| Package | What it does | License |
| --- | --- | --- |
| [`@flink-reactor/dsl`](https://www.npmjs.com/package/@flink-reactor/dsl) | Core DSL engine, components, codegen, and the `flink-reactor` CLI | BSL 1.1 |
| [`@flink-reactor/language-server`](packages/language-server/) | Editor-agnostic LSP backend, synthesis-backed | BSL 1.1 |
| [`@flink-reactor/ts-plugin`](packages/ts-plugin/) | TypeScript language-service plugin | BSL 1.1 |
| [FlinkReactor for VS Code](packages/vscode-extension/) | The VS Code client shell | BSL 1.1 |
| [`@flink-reactor/create-fr-app`](packages/create-fr-app/) | Next.js UI-app scaffolder (design system) | BSL 1.1 |

<details>
<summary><b>Repository layout</b></summary>

```
flink-reactor-dsl/
├── src/                      # Core DSL engine, components, codegen, CLI, testing
├── packages/
│   ├── language-server/      # LSP backend: synthesis-backed diagnostics, hover, navigation
│   ├── ts-plugin/            # TypeScript language-service plugin: JSX nesting + completions
│   ├── vscode-extension/     # VS Code client: live diagnostics, SQL/CRD preview, DAG, schema explorer
│   └── create-fr-app/        # Next.js UI-app scaffolder (@flink-reactor/ui design system)
├── pipelines/                # Production-shaped reference pipelines
└── docs/contributors/specs/  # Behavioral invariant specs (ORD / CLM / NID / TAP)
```

</details>

FlinkReactor is one half of a pair. The DSL solves authorship; the [FlinkReactor Console](https://github.com/sandboxws/flink-reactor-platform) solves operations, which is the back-pressure, multi-cluster, 3-AM-visibility side of running Flink. They're independent but designed to complement each other.

<br />

## <img src="assets/icons/heart-handshake.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> Contributing

Bug reports, feature ideas, and PRs are all welcome. See the **[Contributing Guide](CONTRIBUTING.md)** for setup, workflow, and the release process.

- **Report bugs:** [open an issue](https://github.com/sandboxws/flink-reactor-dsl/issues/new)
- **Suggest features:** [start a discussion](https://github.com/sandboxws/flink-reactor-dsl/issues)
- **Submit PRs:** we use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`). Changes to statement ordering, changelog propagation, node-id assignment, or tap behavior must cite the relevant [invariant spec](docs/contributors/specs/) ID.

<br />

## <img src="assets/icons/scale.svg" width="24" height="24" style="vertical-align: middle; margin-bottom: 2px;"> License

FlinkReactor is licensed under the **[Business Source License 1.1](LICENSE)**.

- **Internal production use is always free.** Use FlinkReactor to build and run your own pipelines, at any scale, without restriction.
- **A commercial license is required** only to offer FlinkReactor (or a derivative) to third parties as a managed service, hosted platform, or API.
- **Converts to [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) on 2030-03-10.** After the change date, this version becomes fully open source.

For commercial-licensing inquiries, see [flink-reactor-platform](https://github.com/sandboxws/flink-reactor-platform).
