/**
 * Built-in query templates for the Materialized Tables explore page.
 *
 * Mirrors the Catalogs `explore-templates.ts` pattern but for materialized
 * tables, targeting the bundled managed Paimon catalog (`paimon_catalog.default`)
 * registered by the server initializer.
 *
 * Scope note — every template here runs against the bundled Paimon catalog on
 * the local sim. Apache Paimon's Flink catalog (as of the bundled version)
 * implements CREATE / DROP materialized tables and reads them as regular
 * tables, but does NOT implement Flink's `SHOW MATERIALIZED TABLES`,
 * `DESCRIBE MATERIALIZED TABLE`, or `ALTER MATERIALIZED TABLE
 * SUSPEND/RESUME/REFRESH`. FULL (scheduled batch) refresh additionally needs a
 * Flink workflow scheduler. So inspection uses `SHOW TABLES` / `DESCRIBE` /
 * `SELECT`, and the create example uses CONTINUOUS refresh (a streaming job, no
 * scheduler required). See the DSL `materialized-tables` template for the same
 * pattern as a deployable app.
 */

import type { ExploreTemplate } from "@/components/catalogs/explore-templates"

export const MATERIALIZED_EXPLORE_TEMPLATES: ExploreTemplate[] = [
  // ── Create ───────────────────────────────────────────────────────
  {
    name: "Live order rollup (continuous)",
    description:
      "Datagen stream → CONTINUOUS materialized table on Paimon, refreshed every 30s",
    category: "Create",
    prefilled: true,
    sql: `-- An unbounded datagen source (region bounded to 5 values so the rollup
-- visibly accumulates) feeds a CONTINUOUS materialized table: Flink runs a
-- streaming job that keeps it fresh within 30 seconds.
CREATE TABLE IF NOT EXISTS orders_src (
  orderId STRING,
  region INT,
  amount DECIMAL(10, 2)
) WITH (
  'connector' = 'datagen',
  'rows-per-second' = '50',
  'fields.region.min' = '1',
  'fields.region.max' = '5'
);

CREATE MATERIALIZED TABLE \`paimon_catalog\`.\`default\`.\`orders_by_region\`
  FRESHNESS = INTERVAL '30' SECOND
  REFRESH_MODE = CONTINUOUS
AS
SELECT
  region,
  COUNT(*) AS order_count,
  SUM(amount) AS total_amount
FROM orders_src
GROUP BY region;`,
  },

  // ── Inspect ──────────────────────────────────────────────────────
  {
    name: "List tables in the catalog",
    description:
      "Materialized tables are stored as Paimon tables — list them with SHOW TABLES",
    category: "Inspect",
    prefilled: true,
    sql: `USE CATALOG \`paimon_catalog\`;
SHOW TABLES;`,
  },
  {
    name: "Describe a materialized table",
    description: "Inspect the materialized table's columns and types",
    category: "Inspect",
    prefilled: true,
    sql: "DESCRIBE `paimon_catalog`.`default`.`orders_by_region`;",
  },
  {
    name: "Preview rows",
    description: "Read the latest materialized rows",
    category: "Inspect",
    prefilled: true,
    sql: "SELECT * FROM `paimon_catalog`.`default`.`orders_by_region` LIMIT 100;",
  },

  // ── Clean up ─────────────────────────────────────────────────────
  {
    name: "Drop materialized table",
    description: "Remove the materialized table and stop its refresh job",
    category: "Clean up",
    prefilled: true,
    sql: "DROP MATERIALIZED TABLE `paimon_catalog`.`default`.`orders_by_region`;",
  },
]
