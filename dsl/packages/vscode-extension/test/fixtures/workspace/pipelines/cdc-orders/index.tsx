import {
  IcebergCatalog,
  IcebergSink,
  Pipeline,
  PostgresCdcPipelineSource,
  secretRef,
} from "@flink-reactor/dsl"

// A Flink CDC Pipeline Connector pipeline (Postgres → Iceberg): the CRD preview
// must show `pipeline.yaml` + `configmap.yaml` tabs (no FlinkDeployment) and
// label the set as a Flink CDC pipeline.
const lake = IcebergCatalog({
  name: "lake",
  catalogType: "rest",
  uri: "http://iceberg-rest:8181",
})

export default (
  <Pipeline name="cdc-orders">
    <PostgresCdcPipelineSource
      hostname="pg-primary"
      port={5432}
      database="shop"
      username="postgres"
      password={secretRef("pg-primary-password")}
      schemaList={["public"]}
      tableList={["public.orders"]}
    >
      <IcebergSink
        catalog={lake.handle}
        database="shop"
        table="orders"
        formatVersion={2}
        upsertEnabled
        primaryKey={["order_id"]}
      />
    </PostgresCdcPipelineSource>
  </Pipeline>
)
