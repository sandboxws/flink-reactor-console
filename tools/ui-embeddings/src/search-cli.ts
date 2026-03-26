/**
 * Interactive search CLI for querying UI component embeddings.
 *
 * Usage: pnpm ui:search <query> [--top-k N]
 *
 * Loads the embedding index, generates a query vector via Ollama,
 * and returns the top-K most similar UI component chunks from LanceDB.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { LanceDbAdapter } from "./db/lancedb.js"
import { checkModel, generateEmbedding } from "./embed.js"

const REPO_ROOT = resolve(import.meta.dirname, "../../..")
const EMBEDDINGS_DIR = resolve(REPO_ROOT, "packages/ui/.embeddings")
const LANCEDB_DIR = resolve(EMBEDDINGS_DIR, "lancedb")
const INDEX_FILE = resolve(EMBEDDINGS_DIR, "index.json")

/** Parse CLI args, embed the query, search LanceDB, and print ranked results. */
async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim()

  if (!query) {
    console.log("\n  Usage: pnpm ui:search <query> [--top-k N]\n")
    console.log("  Examples:")
    console.log('    pnpm ui:search "Button with destructive variant"')
    console.log('    pnpm ui:search "sidebar navigation groups"')
    console.log('    pnpm ui:search "job status colors"')
    console.log('    pnpm ui:search "glassmorphism card" --top-k 3\n')
    process.exit(0)
  }

  // Parse --top-k flag
  let topK = 5
  const topKIdx = process.argv.indexOf("--top-k")
  if (topKIdx !== -1 && process.argv[topKIdx + 1]) {
    topK = parseInt(process.argv[topKIdx + 1], 10) || 5
    // Remove --top-k and its value from the query
  }

  // Check index exists
  if (!existsSync(INDEX_FILE)) {
    console.error(
      "\n  ✗ No embedding index found. Run `pnpm ui:embed` first.\n",
    )
    process.exit(1)
  }

  const meta = JSON.parse(readFileSync(INDEX_FILE, "utf-8"))
  const model = meta.model as string

  // Check model
  const modelReady = await checkModel(model)
  if (!modelReady) {
    console.error(
      `\n  ✗ Model "${model}" not found. Run: ollama pull ${model}\n`,
    )
    process.exit(1)
  }

  // Generate query embedding
  const queryVec = await generateEmbedding(query, model)

  // Search
  const db = new LanceDbAdapter()
  await db.connect(LANCEDB_DIR)
  const results = await db.search(queryVec, topK)
  await db.close()

  // Format output
  console.log(`\n  Query: "${query}"`)
  console.log(`  Model: ${model} | Top-${topK} results\n`)

  if (results.length === 0) {
    console.log("  No results found.\n")
    process.exit(0)
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const rank = `#${i + 1}`.padEnd(4)
    const score = `${(r.score * 100).toFixed(1)}%`
    const typeLabel = r.type.replace(/-/g, " ")
    const component = r.component ? ` (${r.component})` : ""

    console.log(`  ${rank} ${score.padEnd(7)} ${r.path}${component}`)
    console.log(`       Type: ${typeLabel}`)

    // Show a preview of the content (first 2 lines)
    const preview = r.content
      .split("\n")
      .slice(0, 3)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 120)
    console.log(`       ${preview}${r.content.length > 120 ? "..." : ""}`)
    console.log()
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
