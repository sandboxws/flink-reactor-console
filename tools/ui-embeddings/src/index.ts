import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { extractAllChunks, printChunkSummary } from "./chunker.js";
import { generateEmbeddings, checkModel } from "./embed.js";
import { LanceDbAdapter } from "./db/lancedb.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const EMBEDDINGS_DIR = resolve(REPO_ROOT, "packages/ui/.embeddings");
const LANCEDB_DIR = resolve(EMBEDDINGS_DIR, "lancedb");

const DEFAULT_MODEL = "nomic-embed-text";

async function main(): Promise<void> {
  const model = process.argv[2] ?? DEFAULT_MODEL;

  console.log("╭─────────────────────────────────────────╮");
  console.log("│  @flink-reactor/ui — Embedding Builder  │");
  console.log("╰─────────────────────────────────────────╯\n");

  // ── Check Ollama ──────────────────────────────────────────────────────
  console.log(`  Model: ${model}`);
  const modelReady = await checkModel(model);
  if (!modelReady) {
    console.error(`\n  ✗ Model "${model}" not found. Run: ollama pull ${model}`);
    process.exit(1);
  }
  console.log("  ✓ Ollama connected\n");

  // ── Extract chunks ────────────────────────────────────────────────────
  console.log("  Extracting content chunks...");
  const chunks = await extractAllChunks();
  printChunkSummary(chunks);

  if (chunks.length === 0) {
    console.error("\n  ✗ No chunks extracted. Check packages/ui/src/ exists.");
    process.exit(1);
  }

  // ── Generate embeddings ───────────────────────────────────────────────
  console.log(`\n  Generating embeddings with ${model}...`);
  const startTime = Date.now();

  const records = await generateEmbeddings(chunks, model, (done, total) => {
    process.stdout.write(`\r  Progress: ${done}/${total} chunks`);
  });

  const elapsed = Date.now() - startTime;
  console.log(`\n  ✓ ${records.length} embeddings in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`    Avg: ${(elapsed / records.length).toFixed(0)}ms/chunk`);
  console.log(`    Dimensions: ${records[0].vector.length}`);

  // ── Store in LanceDB ──────────────────────────────────────────────────
  console.log("\n  Storing in LanceDB...");
  mkdirSync(LANCEDB_DIR, { recursive: true });

  const db = new LanceDbAdapter();
  await db.connect(LANCEDB_DIR);
  await db.addRecords(records);

  const count = await db.count();
  console.log(`  ✓ ${count} records stored\n`);

  // ── Write metadata ────────────────────────────────────────────────────
  const meta = {
    createdAt: new Date().toISOString(),
    model,
    chunkCount: chunks.length,
    embeddingDimensions: records[0].vector.length,
    avgEmbedTime_ms: Math.round(elapsed / records.length),
    totalTime_ms: elapsed,
  };

  writeFileSync(
    resolve(EMBEDDINGS_DIR, "index.json"),
    JSON.stringify(meta, null, 2),
  );
  console.log("  ✓ Metadata written to packages/ui/.embeddings/index.json");
  console.log("\n  Done! Run `pnpm ui:search <query>` to search.\n");

  await db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
