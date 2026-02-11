// ---------------------------------------------------------------------------
// Flink REST API response types — raw JSON shapes with hyphenated keys
// These mirror the exact API responses; mappers convert them to domain types.
// ---------------------------------------------------------------------------

/**
 * GET /overview
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#overview-1
 */
export interface FlinkOverviewResponse {
  "flink-version": string;
  "flink-commit": string;
  "slots-total": number;
  "slots-available": number;
  "jobs-running": number;
  "jobs-finished": number;
  "jobs-cancelled": number;
  "jobs-failed": number;
  taskmanagers: number;
}

/**
 * Task counts object within each job entry — 10 Flink-native states.
 */
export interface FlinkTaskCounts {
  created: number;
  scheduled: number;
  deploying: number;
  running: number;
  finished: number;
  canceling: number;
  canceled: number;
  failed: number;
  reconciling: number;
  initializing: number;
}

/**
 * Single job entry within the GET /jobs/overview response.
 */
export interface FlinkJobOverviewEntry {
  jid: string;
  name: string;
  state: string;
  "start-time": number;
  "end-time": number;
  duration: number;
  "last-modification": number;
  tasks: FlinkTaskCounts;
}

/**
 * GET /jobs/overview
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-overview
 */
export interface FlinkJobsOverviewResponse {
  jobs: FlinkJobOverviewEntry[];
}
