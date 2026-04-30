# Fluss instrument

The Fluss instrument browses Apache Fluss databases, tables, and TabletServer
health from the FlinkReactor dashboard. It is the runtime counterpart to the
DSL's `pg-fluss-paimon` template — Fluss tables that appear as
`<catalog>.<database>.<table>` references in generated SQL link out to this
instrument's pages instead of staying opaque.

## Configuration

```yaml
instruments:
  - type: fluss
    name: fluss-prod
    config:
      bootstrapServers: fluss-coordinator:9123
      # Optional: admin sidecar HTTP endpoint. Defaults to http://<bootstrapServers>.
      adminEndpoint: http://fluss-admin:8080
      # Optional: ZooKeeper ensemble for the layered health probe.
      zookeeperEnsemble: zk-1:2181,zk-2:2181,zk-3:2181
      # Optional: SASL.
      saslEnabled: true
      saslMechanism: PLAIN
      saslUsername: ${FLUSS_SASL_USERNAME}
      saslPassword: ${FLUSS_SASL_PASSWORD}
```

`bootstrapServers` is the only required field. `adminEndpoint` is the HTTP
base URL the metadata client targets — useful when admin metadata is exposed
through a sidecar in front of the native RPC port.

## Supported Fluss versions

Tracks `0.9.0-incubating` (the version pinned by DSL change 45). The HTTP
admin contract this instrument speaks to is the one supplied by the Fluss
admin sidecar shipped alongside the `pg-fluss-paimon` template.

## Health check

`HealthCheck()` runs a layered probe with a 5-second overall budget:

1. **ZooKeeper reachability** — TCP dial against the configured ensemble. Skipped
   when `zookeeperEnsemble` is empty.
2. **CoordinatorServer** — `GET /api/v1/coordinator/info`.
3. **TabletServer count** — at least one server reporting `alive: true`.

Failures return a typed `*HealthError`. Callers should switch on
`Category()` to render the granular dashboard indicator:

| Category                    | Meaning                                              |
|-----------------------------|------------------------------------------------------|
| `zk-unreachable`            | All ZK quorum endpoints failed the TCP dial.         |
| `coordinator-unresponsive`  | CoordinatorServer did not answer within the budget. |
| `no-tablet-servers`         | Coordinator responded but no TabletServer was alive. |

## Capabilities

- `browse` — `flussDatabases`, `flussTables`, `flussTable` GraphQL queries
- `metrics` — TabletServer leadership counts via `flussTabletServers`
- `highlight` — three-part `<fluss-catalog>.<db>.<table>` references in
  pipeline SQL surface as Fluss `ResourceRef`s with the dashboard route URL

## Highlight semantics

`HighlightResources` recognizes a Fluss catalog two ways:

- A `CREATE CATALOG <name> WITH ('type' = 'fluss', ...)` block declares
  `<name>` as a Fluss catalog explicitly.
- A `CREATE TABLE <cat>.<db>.<tbl> (...) WITH ('connector' = 'fluss', ...)`
  block declares `<cat>` as a Fluss catalog implicitly. This covers pipelines
  whose catalogs are defined in init.sql rather than inline.

Three-part identifiers whose first component matches a Fluss catalog produce
`ResourceRef{Name: "<db>.<tbl>", Role: "source"|"sink", PipelineRelevant: true}`.
The role is inferred from `INSERT INTO` (sink) vs `FROM` (source) clauses.
