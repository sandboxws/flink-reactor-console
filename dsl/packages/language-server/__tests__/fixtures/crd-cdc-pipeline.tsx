import {
  IcebergCatalog,
  IcebergSink,
  Pipeline,
  PostgresCdcPipelineSource,
  secretRef,
} from "@flink-reactor/dsl"

// A Flink CDC Pipeline Connector source (Postgres → Iceberg) synthesizes a
// `pipeline.yaml` plus a wrapping ConfigMap secondary resource instead of a
// FlinkDeployment + SQL ConfigMap. The crd-preview must surface `pipeline.yaml`
// + `configmap.yaml` tabs and label the set as `cdc-pipeline`.
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
