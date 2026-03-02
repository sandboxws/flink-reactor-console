/** A semantic chunk of content ready for embedding. */
export interface ContentChunk {
  /** Unique identifier, e.g. "button-summary" or "tokens-brand-colors" */
  id: string
  /** What kind of chunk this is */
  type:
    | "component-summary"
    | "props-interface"
    | "variant-config"
    | "css-tokens"
    | "css-class"
    | "utility"
    | "constant"
  /** The text content to embed */
  content: string
  /** Source file path relative to packages/ui/ */
  path: string
  /** Component name if applicable */
  component?: string
  /** Arbitrary metadata */
  metadata: Record<string, unknown>
}

/** A chunk with its embedding vector attached. */
export interface EmbeddingRecord extends ContentChunk {
  vector: Float32Array | number[]
}

/** Common interface for vector database adapters. */
export interface VectorDbAdapter {
  name: string
  connect(path: string): Promise<void>
  addRecords(records: EmbeddingRecord[]): Promise<void>
  search(queryVector: number[], topK: number): Promise<SearchResult[]>
  count(): Promise<number>
  close(): Promise<void>
}

/** A single search result. */
export interface SearchResult {
  id: string
  content: string
  path: string
  type: string
  component?: string
  score: number
  metadata: Record<string, unknown>
}

/** Model configuration for benchmarking. */
export interface ModelConfig {
  name: string
  ollamaModel: string
}

/** Benchmark results for a single model+db combination. */
export interface BenchmarkResult {
  model: string
  db: string
  metrics: {
    precision_at_1: number
    precision_at_3: number
    precision_at_5: number
    mrr: number
    avgEmbedTime_ms: number
    avgSearchLatency_ms: number
    totalIndexTime_ms: number
    storageSize_kb: number
  }
  queryResults: Array<{
    query: string
    category: string
    topResults: Array<{ path: string; score: number }>
    relevantFound: boolean
  }>
}

/** A test query for benchmarking retrieval quality. */
export interface TestQuery {
  query: string
  /** File basenames (not full paths) that should appear in top results */
  expectedFiles: string[]
  category: "direct" | "feature" | "props" | "style" | "conceptual"
}
