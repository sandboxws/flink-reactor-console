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

export function createCatalogColumn(overrides?: Partial<CatalogColumn>): CatalogColumn {
  return {
    name: "order_id",
    type: "BIGINT",
    nullable: false,
    description: "Primary key for orders",
    ...overrides,
  }
}

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
