import { beforeEach, describe, expect, it } from "vitest"
import { generateSourceDdl } from "@/codegen/sql/sql-ddl-source.js"
import { YugabyteCdcSource } from "@/components/sources.js"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { Field, Schema } from "@/core/schema.js"
import { secretRef } from "@/core/secret-ref.js"

beforeEach(() => {
  resetNodeIdCounter()
})

// Mirrors the YugabyteDB "Flink CDC for YugabyteDB" blog DDL.
const ShipmentsSchema = Schema({
  fields: {
    shipment_id: Field.INT(),
    order_id: Field.INT(),
    origin: Field.STRING(),
    destination: Field.STRING(),
    is_arrived: Field.BOOLEAN(),
  },
  primaryKey: { columns: ["shipment_id"] },
})

const shipments = () =>
  YugabyteCdcSource({
    hostname: "yb-tserver",
    username: "yugabyte",
    password: secretRef("yb-credentials"),
    database: "yugabyte",
    table: "shipments",
    schema: ShipmentsSchema,
  })

describe("YugabyteCdcSource SQL DDL (connector='postgres-cdc')", () => {
  it("emits the postgres-cdc connector with YugabyteDB defaults", () => {
    const ddl = generateSourceDdl(shipments())
    expect(ddl).not.toBeNull()
    const sql = ddl as string
    expect(sql).toContain("'connector' = 'postgres-cdc'")
    expect(sql).toContain("'port' = '5433'") // YSQL tserver default, not 5432
    expect(sql).toContain("'decoding.plugin.name' = 'pgoutput'") // required by YB
    expect(sql).toContain("'slot.name' = 'flink'")
    expect(sql).toContain("'database-name' = 'yugabyte'")
    expect(sql).toContain("'schema-name' = 'public'")
    expect(sql).toContain("'table-name' = 'shipments'")
    expect(sql).toContain("'username' = 'yugabyte'")
  })

  it("renders the SecretRef password as an ${env:...} placeholder", () => {
    const sql = generateSourceDdl(shipments()) as string
    expect(sql).toContain("'password' = '${env:YB_CREDENTIALS}'")
    // The raw Kubernetes Secret name never leaks as a literal value.
    expect(sql).not.toContain("yb-credentials")
  })

  it("emits PRIMARY KEY ... NOT ENFORCED for the CDC changelog", () => {
    const sql = generateSourceDdl(shipments()) as string
    expect(sql).toMatch(/PRIMARY KEY \(`shipment_id`\) NOT ENFORCED/)
  })

  it("honors overridden port/schema/slot/plugin", () => {
    const sql = generateSourceDdl(
      YugabyteCdcSource({
        hostname: "yb-tserver",
        port: 5555,
        username: "yugabyte",
        password: secretRef("yb-credentials"),
        database: "shop",
        schemaName: "inventory",
        table: "orders",
        slotName: "fr_slot",
        decodingPluginName: "wal2json",
        schema: ShipmentsSchema,
      }),
    ) as string
    expect(sql).toContain("'port' = '5555'")
    expect(sql).toContain("'schema-name' = 'inventory'")
    expect(sql).toContain("'slot.name' = 'fr_slot'")
    expect(sql).toContain("'decoding.plugin.name' = 'wal2json'")
  })

  it("passes optional debezium snapshot/ssl props through", () => {
    const sql = generateSourceDdl(
      YugabyteCdcSource({
        ...({
          hostname: "yb-tserver",
          username: "yugabyte",
          password: secretRef("yb-credentials"),
          database: "yugabyte",
          table: "shipments",
          schema: ShipmentsSchema,
        } as const),
        snapshotMode: "never",
        sslMode: "require",
      }),
    ) as string
    expect(sql).toContain("'debezium.snapshot.mode' = 'never'")
    expect(sql).toContain("'debezium.database.sslmode' = 'require'")
  })

  it("matches the full CREATE TABLE snapshot", () => {
    expect(generateSourceDdl(shipments())).toMatchSnapshot()
  })
})
