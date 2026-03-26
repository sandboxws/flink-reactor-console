/** Fixture data for Flink SQL catalog structures — databases, tables, and column schemas. */

export type CatalogColumn = {
  name: string
  type: string
  nullable: boolean
  description: string
}

export type CatalogSchema = {
  catalog: string
  database: string
  table: string
  columns: CatalogColumn[]
}

/** Create a catalog column fixture with sensible defaults. */
export function createCatalogColumn(overrides?: Partial<CatalogColumn>): CatalogColumn {
  return {
    name: "order_id",
    type: "BIGINT",
    nullable: false,
    description: "Primary key for orders",
    ...overrides,
  }
}

/** Create a catalog schema fixture with a five-column orders table. */
export function createCatalogSchema(overrides?: Partial<CatalogSchema>): CatalogSchema {
  return {
    catalog: "default_catalog",
    database: "default_database",
    table: "orders",
    columns: [
      createCatalogColumn({ name: "order_id", type: "BIGINT", nullable: false }),
      createCatalogColumn({ name: "customer_id", type: "BIGINT", nullable: false, description: "Customer reference" }),
      createCatalogColumn({ name: "amount", type: "DECIMAL(10,2)", nullable: false, description: "Order total" }),
      createCatalogColumn({ name: "status", type: "VARCHAR", nullable: true, description: "Order status" }),
      createCatalogColumn({ name: "created_at", type: "TIMESTAMP(3)", nullable: false, description: "Creation timestamp" }),
    ],
    ...overrides,
  }
}
