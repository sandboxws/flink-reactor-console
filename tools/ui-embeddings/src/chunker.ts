/**
 * Content chunking pipeline for the UI embedding system.
 *
 * Scans the @flink-reactor/ui package and produces semantic content chunks
 * from component files (.tsx/.ts) and style files (.css), ready for embedding.
 */
import { resolve } from "node:path"
import { glob } from "glob"
import { extractComponentChunks } from "./extractors/component.js"
import { extractStyleChunks } from "./extractors/styles.js"
import type { ContentChunk } from "./types.js"

const REPO_ROOT = resolve(import.meta.dirname, "../../..")
const UI_SRC = resolve(REPO_ROOT, "packages/ui/src")

/**
 * Scan the entire UI package and produce semantic content chunks.
 *
 * Returns chunks from:
 *   - Component files (.tsx) — summaries, props, variants
 *   - Style files (.css) — tokens, component classes
 *   - Utility files (.ts) — constants, helpers
 */
export async function extractAllChunks(): Promise<ContentChunk[]> {
  const chunks: ContentChunk[] = []

  // Component and utility files
  const tsFiles = await glob("**/*.{tsx,ts}", {
    cwd: UI_SRC,
    absolute: true,
    ignore: ["**/index.ts"], // Skip barrel re-exports
  })

  for (const file of tsFiles) {
    const fileChunks = extractComponentChunks(file, REPO_ROOT)
    chunks.push(...fileChunks)
  }

  // CSS style files
  const cssFiles = await glob("**/*.css", {
    cwd: UI_SRC,
    absolute: true,
    ignore: ["**/index.css"], // Skip the import-only entry
  })

  for (const file of cssFiles) {
    const fileChunks = extractStyleChunks(file, REPO_ROOT)
    chunks.push(...fileChunks)
  }

  return chunks
}

/** Print a summary table of extracted chunks. */
export function printChunkSummary(chunks: ContentChunk[]): void {
  const byType = new Map<string, number>()
  for (const chunk of chunks) {
    byType.set(chunk.type, (byType.get(chunk.type) ?? 0) + 1)
  }

  console.log(`\n  Extracted ${chunks.length} chunks:\n`)
  for (const [type, count] of [...byType.entries()].sort()) {
    console.log(`    ${type.padEnd(20)} ${count}`)
  }

  const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0)
  console.log(`\n    Total content: ${(totalChars / 1024).toFixed(1)} KB`)
}
