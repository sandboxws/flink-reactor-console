import { ChromaClient } from "chromadb";
import type { VectorDbAdapter, EmbeddingRecord, SearchResult } from "../types.js";

/**
 * ChromaDB adapter — uses the JS client in ephemeral (in-memory) mode.
 *
 * ChromaDB's JS client can either connect to a running server or run
 * in ephemeral mode for testing/benchmarking. For the benchmark comparison,
 * we use ephemeral mode so no external server is needed.
 *
 * Note: For persistent local storage, ChromaDB requires running a Python
 * server (`chroma run --path <dir>`). This is one of the key trade-offs
 * vs LanceDB which is fully embedded.
 */
export class ChromaDbAdapter implements VectorDbAdapter {
  name = "chromadb";
  private client: ChromaClient | null = null;
  private collection: Awaited<ReturnType<ChromaClient["getOrCreateCollection"]>> | null = null;

  async connect(_path: string): Promise<void> {
    // Ephemeral mode — no server needed, in-memory only
    this.client = new ChromaClient();
  }

  async addRecords(records: EmbeddingRecord[]): Promise<void> {
    if (!this.client) throw new Error("Not connected");

    // Delete existing collection if it exists
    try {
      await this.client.deleteCollection({ name: "ui_components" });
    } catch {
      // Collection doesn't exist, that's fine
    }

    this.collection = await this.client.createCollection({
      name: "ui_components",
      metadata: { "hnsw:space": "cosine" },
    });

    // ChromaDB accepts batches
    await this.collection.add({
      ids: records.map((r) => r.id),
      embeddings: records.map((r) => Array.from(r.vector)),
      documents: records.map((r) => r.content),
      metadatas: records.map((r) => ({
        type: r.type,
        path: r.path,
        component: r.component ?? "",
        metadata_json: JSON.stringify(r.metadata),
      })),
    });
  }

  async search(queryVector: number[], topK: number): Promise<SearchResult[]> {
    if (!this.collection) throw new Error("No collection loaded");

    const results = await this.collection.query({
      queryEmbeddings: [queryVector],
      nResults: topK,
    });

    const ids = results.ids[0] ?? [];
    const docs = results.documents[0] ?? [];
    const distances = results.distances?.[0] ?? [];
    const metas = results.metadatas?.[0] ?? [];

    return ids.map((id, i) => ({
      id: id ?? "",
      content: docs[i] ?? "",
      path: (metas[i] as Record<string, string>)?.path ?? "",
      type: (metas[i] as Record<string, string>)?.type ?? "",
      component: (metas[i] as Record<string, string>)?.component || undefined,
      // ChromaDB with cosine space returns distance (0 = identical, 2 = opposite)
      // Convert to similarity: 1 - (distance / 2)
      score: 1 - ((distances[i] ?? 0) / 2),
      metadata: JSON.parse(
        (metas[i] as Record<string, string>)?.metadata_json ?? "{}",
      ),
    }));
  }

  async count(): Promise<number> {
    if (!this.collection) throw new Error("No collection loaded");
    return this.collection.count();
  }

  async close(): Promise<void> {
    this.client = null;
    this.collection = null;
  }
}
