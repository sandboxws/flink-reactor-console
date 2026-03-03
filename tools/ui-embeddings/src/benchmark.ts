import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { extractAllChunks, printChunkSummary } from "./chunker.js"
import { ChromaDbAdapter } from "./db/chromadb.js"
import { LanceDbAdapter } from "./db/lancedb.js"
import { checkModel, generateEmbedding, generateEmbeddings } from "./embed.js"
import type {
  BenchmarkResult,
  EmbeddingRecord,
  ModelConfig,
  TestQuery,
  VectorDbAdapter,
} from "./types.js"

const REPO_ROOT = resolve(import.meta.dirname, "../../..")
const EMBEDDINGS_DIR = resolve(REPO_ROOT, "packages/ui/.embeddings")

// ── Models to compare ──────────────────────────────────────────────────────
const MODELS: ModelConfig[] = [
  { name: "nomic-embed-text", ollamaModel: "nomic-embed-text" },
  { name: "nomic-embed-text-v2-moe", ollamaModel: "nomic-embed-text-v2-moe" },
]

// ── Test queries ───────────────────────────────────────────────────────────
const TEST_QUERIES: TestQuery[] = [
  // Direct component lookup
  {
    query: "Button component with different variants",
    expectedFiles: ["button.tsx"],
    category: "direct",
  },
  {
    query: "Dialog modal popup overlay",
    expectedFiles: ["dialog.tsx"],
    category: "direct",
  },
  {
    query: "Tabs component tabbed interface",
    expectedFiles: ["tabs.tsx"],
    category: "direct",
  },
  {
    query: "Progress bar indicator",
    expectedFiles: ["progress.tsx"],
    category: "direct",
  },

  // Feature-based search
  {
    query: "collapsible sidebar with navigation groups",
    expectedFiles: ["sidebar.tsx"],
    category: "feature",
  },
  {
    query: "command palette with keyboard shortcut search",
    expectedFiles: ["command-palette.tsx"],
    category: "feature",
  },
  {
    query: "text viewer with line numbers and copy",
    expectedFiles: ["text-viewer.tsx"],
    category: "feature",
  },
  {
    query: "resizable split panels layout",
    expectedFiles: ["resizable.tsx"],
    category: "feature",
  },

  // Props/API search
  {
    query: "MetricCard props for displaying statistics with icon",
    expectedFiles: ["metric-card.tsx"],
    category: "props",
  },
  {
    query: "SearchInput with regex mode toggle",
    expectedFiles: ["search-input.tsx"],
    category: "props",
  },
  {
    query: "TimeRange presets for 5 minutes 15 minutes 1 hour",
    expectedFiles: ["time-range.tsx"],
    category: "props",
  },
  {
    query: "Sidebar LinkComponent prop for custom router",
    expectedFiles: ["sidebar.tsx"],
    category: "props",
  },

  // Style/theming search
  {
    query: "Tokyo Night theme color palette brand colors",
    expectedFiles: ["tokens.css"],
    category: "style",
  },
  {
    query: "job status colors running finished cancelled failed",
    expectedFiles: ["tokens.css"],
    category: "style",
  },
  {
    query: "glass card glassmorphism backdrop blur effect",
    expectedFiles: ["components.css"],
    category: "style",
  },
  {
    query: "log severity badge styling trace debug info warn error",
    expectedFiles: ["components.css", "severity-badge.tsx"],
    category: "style",
  },

  // Conceptual/use-case search
  {
    query: "display empty placeholder when no data available",
    expectedFiles: ["empty-state.tsx"],
    category: "conceptual",
  },
  {
    query: "breadcrumb navigation from URL path segments",
    expectedFiles: ["header.tsx"],
    category: "conceptual",
  },
  {
    query: "hoverable card with preview content",
    expectedFiles: ["hover-card.tsx"],
    category: "conceptual",
  },
  {
    query: "application shell with sidebar and header",
    expectedFiles: ["shell.tsx"],
    category: "conceptual",
  },
]

const TOP_K = 5

// ── Evaluation helpers ─────────────────────────────────────────────────────

function precisionAtK(
  results: Array<{ path: string }>,
  expectedFiles: string[],
  k: number,
): number {
  const topK = results.slice(0, k)
  const relevant = topK.filter((r) =>
    expectedFiles.some((f) => r.path.includes(f)),
  )
  return relevant.length / k
}

function reciprocalRank(
  results: Array<{ path: string }>,
  expectedFiles: string[],
): number {
  for (let i = 0; i < results.length; i++) {
    if (expectedFiles.some((f) => results[i].path.includes(f))) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/** Recursively sum file sizes in a directory (KB). */
function dirSizeKB(dirPath: string): number {
  try {
    let total = 0
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += dirSizeKB(fullPath)
      } else {
        total += statSync(fullPath).size
      }
    }
    return Math.round(total / 1024)
  } catch {
    return 0
  }
}

// ── Main benchmark ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╭─────────────────────────────────────────╮")
  console.log("│  Embedding Model & DB Benchmark         │")
  console.log("╰─────────────────────────────────────────╯\n")

  // Verify models
  for (const model of MODELS) {
    const ready = await checkModel(model.ollamaModel)
    if (!ready) {
      console.error(
        `  ✗ Model "${model.ollamaModel}" not found. Run: ollama pull ${model.ollamaModel}`,
      )
      process.exit(1)
    }
    console.log(`  ✓ ${model.name} available`)
  }

  // Extract chunks
  console.log("\n  Extracting content chunks...")
  const chunks = await extractAllChunks()
  printChunkSummary(chunks)

  const results: BenchmarkResult[] = []

  for (const model of MODELS) {
    console.log(`\n${"═".repeat(60)}`)
    console.log(`  MODEL: ${model.name}`)
    console.log(`${"═".repeat(60)}`)

    // Generate embeddings (timed)
    console.log(`\n  Generating embeddings...`)
    const embedStart = Date.now()
    const records = await generateEmbeddings(
      chunks,
      model.ollamaModel,
      (done, total) => {
        process.stdout.write(`\r  Progress: ${done}/${total}`)
      },
    )
    const totalEmbedTime = Date.now() - embedStart
    console.log(
      `\n  ✓ ${records.length} embeddings in ${(totalEmbedTime / 1000).toFixed(1)}s`,
    )
    console.log(`    Dimensions: ${records[0].vector.length}`)
    console.log(
      `    Avg embed time: ${(totalEmbedTime / records.length).toFixed(0)}ms/chunk`,
    )

    // ── Test with LanceDB ──────────────────────────────────────────────
    await benchmarkDb(
      model,
      records,
      new LanceDbAdapter(),
      resolve(EMBEDDINGS_DIR, `benchmark-lancedb-${model.name}`),
      results,
      totalEmbedTime,
    )

    // ── Test with ChromaDB ─────────────────────────────────────────────
    // ChromaDB JS client requires a running server. Try connecting; skip gracefully if unavailable.
    try {
      await benchmarkDb(
        model,
        records,
        new ChromaDbAdapter(),
        resolve(EMBEDDINGS_DIR, `benchmark-chromadb-${model.name}`),
        results,
        totalEmbedTime,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Failed to connect") || msg.includes("ECONNREFUSED")) {
        console.log(`\n  ── chromadb ──`)
        console.log(
          `    ⚠ ChromaDB server not running (requires: chroma run --path <dir>)`,
        )
        console.log(
          `    ⚠ Skipping — ChromaDB JS client cannot run in embedded mode.`,
        )
        console.log(
          `    ⚠ This is a key trade-off: LanceDB is fully embedded, ChromaDB is not.\n`,
        )
      } else {
        throw err
      }
    }
  }

  // ── Print comparison table ───────────────────────────────────────────
  printComparisonTable(results)

  // ── Save results ─────────────────────────────────────────────────────
  const outputPath = resolve(EMBEDDINGS_DIR, "benchmark-results.json")
  mkdirSync(EMBEDDINGS_DIR, { recursive: true })
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        testQueries: TEST_QUERIES.length,
        topK: TOP_K,
        results,
        recommendation: pickRecommendation(results),
        chromadbNote: results.every((r) => r.db === "lancedb")
          ? "ChromaDB was skipped because it requires a running server (chroma run). Its JS client cannot run in embedded mode, unlike LanceDB."
          : undefined,
      },
      null,
      2,
    ),
  )
  console.log(`\n  Results saved to: ${outputPath}\n`)
}

async function benchmarkDb(
  model: ModelConfig,
  records: EmbeddingRecord[],
  db: VectorDbAdapter,
  dbPath: string,
  allResults: BenchmarkResult[],
  totalEmbedTime: number,
): Promise<void> {
  console.log(`\n  ── ${db.name} ──`)

  // Index
  mkdirSync(dbPath, { recursive: true })
  const indexStart = Date.now()
  await db.connect(dbPath)
  await db.addRecords(records)
  const indexTime = Date.now() - indexStart
  console.log(`    Index build: ${indexTime}ms`)

  // Query each test case
  const queryResults: BenchmarkResult["queryResults"] = []
  const searchLatencies: number[] = []

  for (const tq of TEST_QUERIES) {
    const queryVec = await generateEmbedding(tq.query, model.ollamaModel)
    const searchStart = Date.now()
    const hits = await db.search(queryVec, TOP_K)
    searchLatencies.push(Date.now() - searchStart)

    queryResults.push({
      query: tq.query,
      category: tq.category,
      topResults: hits.map((h) => ({ path: h.path, score: h.score })),
      relevantFound: hits.some((h) =>
        tq.expectedFiles.some((f) => h.path.includes(f)),
      ),
    })
  }

  // Calculate metrics
  const p1_scores = queryResults.map((qr, i) =>
    precisionAtK(qr.topResults, TEST_QUERIES[i].expectedFiles, 1),
  )
  const p3_scores = queryResults.map((qr, i) =>
    precisionAtK(qr.topResults, TEST_QUERIES[i].expectedFiles, 3),
  )
  const p5_scores = queryResults.map((qr, i) =>
    precisionAtK(qr.topResults, TEST_QUERIES[i].expectedFiles, 5),
  )
  const rr_scores = queryResults.map((qr, i) =>
    reciprocalRank(qr.topResults, TEST_QUERIES[i].expectedFiles),
  )

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const benchResult: BenchmarkResult = {
    model: model.name,
    db: db.name,
    metrics: {
      precision_at_1: avg(p1_scores),
      precision_at_3: avg(p3_scores),
      precision_at_5: avg(p5_scores),
      mrr: avg(rr_scores),
      avgEmbedTime_ms: Math.round(totalEmbedTime / records.length),
      avgSearchLatency_ms: Math.round(avg(searchLatencies)),
      totalIndexTime_ms: indexTime,
      storageSize_kb: dirSizeKB(dbPath),
    },
    queryResults,
  }

  allResults.push(benchResult)

  console.log(
    `    P@1: ${(benchResult.metrics.precision_at_1 * 100).toFixed(1)}%`,
  )
  console.log(
    `    P@3: ${(benchResult.metrics.precision_at_3 * 100).toFixed(1)}%`,
  )
  console.log(`    MRR: ${(benchResult.metrics.mrr * 100).toFixed(1)}%`)
  console.log(`    Avg search: ${benchResult.metrics.avgSearchLatency_ms}ms`)
  console.log(`    Storage: ${benchResult.metrics.storageSize_kb}KB`)

  await db.close()
}

function printComparisonTable(results: BenchmarkResult[]): void {
  console.log(`\n${"═".repeat(70)}`)
  console.log("  COMPARISON TABLE")
  console.log(`${"═".repeat(70)}\n`)

  const header =
    "  Config".padEnd(38) +
    "P@1".padStart(8) +
    "P@3".padStart(8) +
    "MRR".padStart(8) +
    "Embed".padStart(9) +
    "Search".padStart(9) +
    "Size".padStart(9)
  console.log(header)
  console.log(`  ${"─".repeat(68)}`)

  for (const r of results) {
    const label = `  ${r.model} + ${r.db}`.padEnd(38)
    const p1 = `${(r.metrics.precision_at_1 * 100).toFixed(1)}%`.padStart(8)
    const p3 = `${(r.metrics.precision_at_3 * 100).toFixed(1)}%`.padStart(8)
    const mrr = `${(r.metrics.mrr * 100).toFixed(1)}%`.padStart(8)
    const embed = `${r.metrics.avgEmbedTime_ms}ms`.padStart(9)
    const search = `${r.metrics.avgSearchLatency_ms}ms`.padStart(9)
    const size = `${r.metrics.storageSize_kb}KB`.padStart(9)
    console.log(`${label}${p1}${p3}${mrr}${embed}${search}${size}`)
  }
}

function pickRecommendation(results: BenchmarkResult[]): {
  model: string
  db: string
  rationale: string
} {
  // Rank by MRR (primary) then by search latency (secondary)
  const sorted = [...results].sort((a, b) => {
    const mrrDiff = b.metrics.mrr - a.metrics.mrr
    if (Math.abs(mrrDiff) > 0.02) return mrrDiff // >2% MRR difference matters
    return a.metrics.avgSearchLatency_ms - b.metrics.avgSearchLatency_ms
  })

  const best = sorted[0]
  const bestMRR = (best.metrics.mrr * 100).toFixed(1)
  const bestP1 = (best.metrics.precision_at_1 * 100).toFixed(1)

  return {
    model: best.model,
    db: best.db,
    rationale: `Best MRR (${bestMRR}%) and P@1 (${bestP1}%) with ${best.metrics.avgSearchLatency_ms}ms search latency`,
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
