import {
  FlussCatalog,
  FlussSink,
  Pipeline,
  PostgresCdcPipelineSource,
  secretRef,
} from "@flink-reactor/dsl"

// Factory-call (non-JSX) style — the idiomatic alternative the scaffolder
// emits (`pipelines/ingest`). Nodes are created by named factory calls assigned
// to vars and embedded as computed children. Exercises the mapper's
// named-component-factory-call path; the parity gate guards against the
// "N of N construct nodes could not be located" regression.
const catalog = FlussCatalog({
  name: "fluss_catalog",
  bootstrapServers: "fluss-coordinator:9123",
})

const source = PostgresCdcPipelineSource({
  hostname: "postgres",
  port: 5432,
  database: "tpch",
  username: "flink_cdc",
  password: secretRef("PG_PRIMARY_PASSWORD"),
  schemaList: ["public"],
  tableList: ["public.orders"],
  snapshotMode: "initial",
  eventTimeColumn: "event_time",
})

const sink = FlussSink({
  catalog: catalog.handle,
  database: "public",
  table: "orders",
  primaryKey: ["o_orderkey"],
  buckets: 8,
  children: [source],
})

export default (
  <Pipeline
    name="ingest"
    parallelism={4}
    checkpoint={{ interval: "10s", mode: "exactly-once" }}
  >
    {catalog.node}
    {sink}
  </Pipeline>
)
