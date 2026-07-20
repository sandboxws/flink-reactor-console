import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runSchemaGenerate } from "@/cli/commands/schema-generate.js"
import { resetIntrospectCache } from "@/cli/connectors/postgres-introspect.js"
import { createProgram } from "@/cli/program.js"

// Mocked pg driver (mirrors postgres-introspect.test.ts).
class FakeClient {
  constructor(_config: { connectionString: string }) {}
  connect() {
    return Promise.resolve()
  }
  query(text: string, _values?: unknown[]) {
    if (text.includes("information_schema.columns")) {
      return Promise.resolve({
        rows: [
          {
            table_schema: "public",
            table_name: "orders",
            column_name: "order_id",
            data_type: "bigint",
            udt_name: "int8",
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            ordinal_position: 1,
            is_nullable: "NO",
          },
          {
            table_schema: "public",
            table_name: "orders",
            column_name: "amount",
            data_type: "numeric",
            udt_name: "numeric",
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 2,
            ordinal_position: 2,
            is_nullable: "YES",
          },
          {
            table_schema: "public",
            table_name: "orders",
            column_name: "product",
            data_type: "character varying",
            udt_name: "varchar",
            character_maximum_length: 200,
            numeric_precision: null,
            numeric_scale: null,
            ordinal_position: 3,
            is_nullable: "YES",
          },
        ],
      })
    }
    return Promise.resolve({
      rows: [
        {
          table_schema: "public",
          table_name: "orders",
          column_name: "order_id",
        },
      ],
    })
  }
  end() {
    return Promise.resolve()
  }
}
vi.mock("pg", () => ({ default: { Client: FakeClient }, Client: FakeClient }))

const PG_CONFIG = `export default {
  services: { postgres: { externalPort: 5433, user: 'reactor', password: 'reactor', database: 'shop' } },
  sources: { orders: { type: 'postgres', table: 'public.orders' } },
};
`

describe("schema generate", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "fr-schema-gen-"))
    resetIntrospectCache()
  })
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function writeConfig(body: string): void {
    writeFileSync(join(tempDir, "flink-reactor.config.ts"), body, "utf-8")
  }

  it("generates a schema module for a postgres source (all fields)", async () => {
    writeConfig(PG_CONFIG)
    await runSchemaGenerate({
      source: "orders",
      all: true,
      projectDir: tempDir,
    })

    const content = readFileSync(join(tempDir, "schemas", "orders.ts"), "utf-8")
    expect(content).toContain("export const OrdersSchema = Schema({")
    expect(content).toContain("order_id: Field.BIGINT()")
    expect(content).toContain("amount: Field.DECIMAL(10, 2)")
    expect(content).toContain("product: Field.VARCHAR(200)")
    expect(content).toContain("primaryKey: { columns: ['order_id'] }")
  })

  it("honors --fields to select a subset (preserving introspection order)", async () => {
    writeConfig(PG_CONFIG)
    await runSchemaGenerate({
      source: "orders",
      fields: "amount,order_id",
      projectDir: tempDir,
    })

    const content = readFileSync(join(tempDir, "schemas", "orders.ts"), "utf-8")
    expect(content).toContain("order_id: Field.BIGINT()")
    expect(content).toContain("amount: Field.DECIMAL(10, 2)")
    expect(content).not.toContain("product")
    expect(content.indexOf("order_id")).toBeLessThan(content.indexOf("amount"))
  })

  it("errors on unknown field names", async () => {
    writeConfig(PG_CONFIG)
    await expect(
      runSchemaGenerate({
        source: "orders",
        fields: "nope",
        projectDir: tempDir,
      }),
    ).rejects.toThrow(/Unknown field/)
  })

  it("guards against overwriting unless --force is passed", async () => {
    writeConfig(PG_CONFIG)
    await runSchemaGenerate({
      source: "orders",
      all: true,
      projectDir: tempDir,
    })
    await expect(
      runSchemaGenerate({ source: "orders", all: true, projectDir: tempDir }),
    ).rejects.toThrow(/already exists/)
    await expect(
      runSchemaGenerate({
        source: "orders",
        all: true,
        force: true,
        projectDir: tempDir,
      }),
    ).resolves.toBeUndefined()
  })

  it("errors for an unknown source name", async () => {
    writeConfig(PG_CONFIG)
    await expect(
      runSchemaGenerate({ source: "ghost", all: true, projectDir: tempDir }),
    ).rejects.toThrow(/Unknown source/)
  })

  it("errors when no sources are declared", async () => {
    writeConfig("export default { services: {} };\n")
    await expect(
      runSchemaGenerate({ source: "orders", all: true, projectDir: tempDir }),
    ).rejects.toThrow(/No .sources. declared/)
  })
})

describe("schema command wiring", () => {
  it("registers `generate` as a subcommand of `schema`", () => {
    const program = createProgram()
    const schema = program.commands.find((c) => c.name() === "schema")
    expect(schema).toBeDefined()
    const generate = schema?.commands.find((c) => c.name() === "generate")
    expect(generate).toBeDefined()
  })
})
