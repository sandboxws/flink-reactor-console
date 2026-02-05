import { Ollama } from "ollama";
import type { ContentChunk, EmbeddingRecord } from "./types.js";

const ollama = new Ollama();

/**
 * Generate a single embedding vector via Ollama.
 */
export async function generateEmbedding(
  text: string,
  model: string,
): Promise<number[]> {
  const response = await ollama.embed({ model, input: text });
  return response.embeddings[0];
}

/**
 * Generate embeddings for a batch of content chunks.
 *
 * Processes sequentially to avoid overwhelming Ollama's queue.
 * Returns EmbeddingRecords with vectors attached.
 */
export async function generateEmbeddings(
  chunks: ContentChunk[],
  model: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<EmbeddingRecord[]> {
  const records: EmbeddingRecord[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vector = await generateEmbedding(chunk.content, model);
    records.push({ ...chunk, vector });
    onProgress?.(i + 1, chunks.length);
  }

  return records;
}

/**
 * Verify that Ollama is running and the given model is available.
 */
export async function checkModel(model: string): Promise<boolean> {
  try {
    const list = await ollama.list();
    return list.models.some((m) => m.name.startsWith(model));
  } catch {
    return false;
  }
}
