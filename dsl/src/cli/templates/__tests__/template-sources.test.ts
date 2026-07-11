// Round-trip guardrail for the `sources` → `schema generate` contract.
//
// For every template that declares `sources`, each source key must map to a
// shipped `schemas/<key>.ts` that exports `const <PascalCase(key)>Schema`.
// That is exactly what `fr schema generate <key> --force` regenerates, so if a
// source key, the schema filename, and the exported const ever drift apart,
// `--force` would overwrite a file the pipeline no longer imports — this test
// fails first.
//
// Stock (`stock-*`) and structural (`minimal`, `monorepo`) templates are
// intentionally excluded: their Kafka sources are CSV/positional (nothing for
// a schema registry to introspect) or their schemas follow the upstream
// default-export convention, both outside the schema-generate model.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
  type ScaffoldOptions,
  scaffoldProject,
  type TemplateName,
} from "@/cli/commands/new.js"

const APPLICABLE: readonly TemplateName[] = [
  "starter",
  "cdc-lakehouse",
  "data-quality",
  "realtime-analytics",
  "ecommerce",
  "ride-sharing",
  "grocery-delivery",
  "banking",
  "iot-factory",
  "lakehouse-ingestion",
  "lakehouse-analytics",
  "pg-fluss-paimon",
]

const tempDirs: string[] = []

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

function pascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

/** Brace-match the `sources: { ... }` block and pull its top-level keys. */
function extractSourceKeys(config: string): string[] {
  const marker = config.indexOf("sources: {")
  if (marker === -1) return []
  const open = config.indexOf("{", marker)
  let depth = 0
  let close = -1
  for (let i = open; i < config.length; i++) {
    if (config[i] === "{") depth++
    else if (config[i] === "}") {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  const block = config.slice(open + 1, close)
  // Top-level entries look like `orders: {` or `'order-items': {`.
  const re = /(?:^|\n)\s*['"]?([A-Za-z][\w-]*)['"]?\s*:\s*\{/g
  return [...block.matchAll(re)].map((match) => match[1]!)
}

function scaffold(template: TemplateName): string {
  const tempRoot = mkdtempSync(join(tmpdir(), "fr-sources-"))
  tempDirs.push(tempRoot)
  const projectDir = join(tempRoot, "app")
  const opts: ScaffoldOptions = {
    projectName: "sources-test",
    template,
    pm: "pnpm",
    flinkVersion: "2.0",
    gitInit: false,
    installDeps: false,
  }
  scaffoldProject(projectDir, opts)
  return projectDir
}

describe("template sources ↔ schema files (exact round-trip guardrail)", () => {
  for (const template of APPLICABLE) {
    it(`${template}: each sources key maps to schemas/<key>.ts exporting <PascalCase>Schema`, () => {
      const dir = scaffold(template)
      const config = readFileSync(join(dir, "flink-reactor.config.ts"), "utf-8")
      const keys = extractSourceKeys(config)

      // Every applicable template must actually declare at least one source.
      expect(keys.length).toBeGreaterThan(0)

      for (const key of keys) {
        const schemaFile = join(dir, "schemas", `${key}.ts`)
        expect(
          existsSync(schemaFile),
          `${template}: source '${key}' has no schemas/${key}.ts`,
        ).toBe(true)

        const content = readFileSync(schemaFile, "utf-8")
        const expectedConst = `${pascalCase(key)}Schema`
        expect(
          content.includes(`export const ${expectedConst}`),
          `${template}: schemas/${key}.ts must export const ${expectedConst} (schema generate --force reproduces this name)`,
        ).toBe(true)
      }
    })
  }
})
