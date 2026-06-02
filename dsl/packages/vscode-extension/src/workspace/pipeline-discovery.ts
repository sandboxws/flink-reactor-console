import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/** A discovered pipeline: its directory name and the absolute `index.tsx` path. */
export interface DiscoveredPipeline {
  readonly name: string
  readonly entryPoint: string
}

/**
 * Discover pipelines under `<projectDir>/pipelines`: each subdirectory that
 * holds an `index.tsx` is one pipeline, returned sorted by name.
 *
 * Mirrors the convention in `@flink-reactor/dsl` `discoverPipelines`
 * (`src/cli/discovery.ts`), reimplemented `fs`-only so the extension host does
 * not bundle the DSL's jiti-based Node loader.
 */
export function discoverPipelines(projectDir: string): DiscoveredPipeline[] {
  const pipelinesDir = join(projectDir, "pipelines")
  if (!existsSync(pipelinesDir)) return []

  const pipelines: DiscoveredPipeline[] = []
  for (const entry of readdirSync(pipelinesDir)) {
    const entryPath = join(pipelinesDir, entry)
    if (!statSync(entryPath).isDirectory()) continue
    const indexPath = join(entryPath, "index.tsx")
    if (!existsSync(indexPath)) continue
    pipelines.push({ name: entry, entryPoint: indexPath })
  }
  return pipelines.sort((a, b) => a.name.localeCompare(b.name))
}
