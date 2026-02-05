import * as lancedb from "@lancedb/lancedb";
import type { VectorDbAdapter, EmbeddingRecord, SearchResult } from "../types.js";

/**
 * LanceDB adapter — fully embedded, no server process needed.
 *
 * Stores data in Lance columnar format on local disk.
 * Uses L2 distance by default; we convert to cosine similarity in results.
 */
export class LanceDbAdapter implements VectorDbAdapter {
  name = "lancedb";
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private dbPath = "";

  async connect(path: string): Promise<void> {
    this.dbPath = path;
    this.db = await lancedb.connect(path);
  }

  async addRecords(records: EmbeddingRecord[]): Promise<void> {
    if (!this.db) throw new Error("Not connected");

    // Convert to plain objects for LanceDB
    const rows = records.map((r) => ({
      id: r.id,
      vector: Array.from(r.vector),
      content: r.content,
      type: r.type,
      path: r.path,
      component: r.component ?? "",
      metadata_json: JSON.stringify(r.metadata),
    }));

    // Overwrite existing table
    const tableNames = await this.db.tableNames();
    if (tableNames.includes("ui_components")) {
      await this.db.dropTable("ui_components");
    }

    this.table = await this.db.createTable("ui_components", rows);
  }

  async search(queryVector: number[], topK: number): Promise<SearchResult[]> {
    if (!this.db) throw new Error("Not connected");

    if (!this.table) {
      this.table = await this.db.openTable("ui_components");
    }

    const results = await this.table
      .search(queryVector)
      .limit(topK)
      .toArray();

    return results.map((row) => ({
      id: row.id as string,
      content: row.content as string,
      path: row.path as string,
      type: row.type as string,
      component: (row.component as string) || undefined,
      // LanceDB returns _distance (L2). Convert to similarity: 1 / (1 + distance)
      score: 1 / (1 + (row._distance as number)),
      metadata: JSON.parse(row.metadata_json as string),
    }));
  }

  async count(): Promise<number> {
    if (!this.db) throw new Error("Not connected");
    if (!this.table) {
      this.table = await this.db.openTable("ui_components");
    }
    return this.table.countRows();
  }

  async close(): Promise<void> {
    this.db = null;
    this.table = null;
  }
}
