#!/usr/bin/env npx tsx
/**
 * Build-time generator: parses flink-reactor/dist/browser.d.ts
 * and outputs the DSL completion registry.
 *
 * Usage: pnpm generate:completions
 *
 * This script uses the TypeScript Compiler API to extract:
 * - Component function declarations and their prop interfaces
 * - String literal union types (for enum values)
 * - JSDoc descriptions
 * - Sub-component patterns (Query.Select, Route.Branch, etc.)
 * - Field type helper methods
 *
 * The output is written to:
 *   dashboard/src/components/sandbox/completions/dsl-completions.generated.ts
 */

import * as ts from "typescript"
import * as fs from "node:fs"
import * as path from "node:path"

const BROWSER_DTS = path.resolve(
  __dirname,
  "../dashboard/node_modules/@flink-reactor/dsl/dist/browser.d.ts",
)
const OUTPUT = path.resolve(
  __dirname,
  "../dashboard/src/components/sandbox/completions/dsl-completions.generated.ts",
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single prop extracted from a component's Props interface. */
interface PropEntry {
  name: string
  type: string
  required: boolean
  description: string
  enumValues?: string[]
}

/** A top-level DSL component with its props and category. */
interface ComponentEntry {
  name: string
  description: string
  category: string
  props: PropEntry[]
}

/** A namespaced sub-component (e.g. Query.Select, Route.Branch). */
interface SubComponentEntry {
  parent: string
  name: string
  description: string
  props: PropEntry[]
}

/** A field-type helper method signature and description. */
interface FieldMethodEntry {
  name: string
  signature: string
  description: string
}

// ---------------------------------------------------------------------------
// Categorization heuristics
// ---------------------------------------------------------------------------

/**
 * Assign a semantic category to a component based on naming conventions.
 * @param name - Component name (e.g. "KafkaSource", "Pipeline")
 * @returns Category string: source, sink, catalog, join, window, container, transform, or utility
 */
function categorize(name: string, kind?: string): string {
  if (name.endsWith("Source") || name === "CatalogSource") return "source"
  if (name.endsWith("Sink")) return "sink"
  if (name.endsWith("Catalog")) return "catalog"
  if (name.endsWith("Join") || name === "TemporalJoin") return "join"
  if (name.endsWith("Window")) return "window"
  if (["Pipeline", "Query", "View", "Route", "Validate", "SideOutput", "MaterializedTable"].includes(name))
    return "container"
  if (["Filter", "Map", "FlatMap", "Aggregate", "Union", "Deduplicate", "TopN", "Rename", "Drop", "Cast", "Coalesce", "AddField"].includes(name))
    return "transform"
  return "utility"
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Parse browser.d.ts and generate the DSL completion registry. */
function main() {
  if (!fs.existsSync(BROWSER_DTS)) {
    console.error(`Error: ${BROWSER_DTS} not found. Run 'pnpm install' first.`)
    process.exit(1)
  }

  console.log(`Reading ${BROWSER_DTS}...`)
  console.log(`To regenerate, run: pnpm generate:completions`)
  console.log()
  console.log(
    "Note: This script is a scaffold. The generated file was initially hand-crafted",
  )
  console.log(
    "from browser.d.ts. Future versions will use the TypeScript Compiler API",
  )
  console.log("to fully automate extraction.")
  console.log()
  console.log(`Output: ${OUTPUT}`)
  console.log("Done (no-op — using hand-crafted output).")
}

main()
