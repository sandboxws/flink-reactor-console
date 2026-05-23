/**
 * useMetricStream — sub-second Hub overview KPI ticker.
 *
 * Subscribes to the server's `metricStream(clusterID, metric, jobId)`
 * GraphQL subscription. The server's MetricSampler emits events at ~1s
 * cadence from cached rates; this hook surfaces only the latest value.
 *
 * Fallback semantics: when the subscription is unavailable (no clusterID,
 * connection error, or no data yet), `value` stays null and callers should
 * fall back to the existing 5s polling source. See `routes/hub/index.tsx`
 * for the wire-up.
 */

import { useSubscription } from "urql"
import type {
  MetricStreamSubscription,
  MetricStreamSubscriptionVariables,
} from "@/graphql/generated/types"

/** GraphQL document is parsed by urql at runtime — keep the literal in sync with
 *  `dashboard/src/graphql/documents/subscriptions.graphql`. */
const METRIC_STREAM_DOCUMENT = /* GraphQL */ `
  subscription MetricStream($clusterID: String!, $metric: String!, $jobId: ID) {
    metricStream(clusterID: $clusterID, metric: $metric, jobId: $jobId) {
      clusterID
      jobId
      metric
      value
      timestamp
    }
  }
`

export type MetricStreamResult = {
  /** Latest value from the subscription, or null until the first event arrives. */
  value: number | null
  /** Timestamp of the latest event (RFC3339Nano), or null. */
  timestamp: string | null
  /** True when the subscription has reported an error (caller should fall back). */
  error: boolean
  /** True until the subscription has produced its first value. */
  loading: boolean
}

/**
 * Subscribes to a single metric stream. Pass `jobId: null` (or omit) for
 * cluster-wide aggregates; pass a value for per-job rates.
 *
 * Pausing: when `clusterID` is null/empty, the subscription is paused —
 * the hook returns the empty state and opens no WebSocket.
 */
export function useMetricStream(
  clusterID: string | null | undefined,
  metric: string,
  jobId?: string | null,
): MetricStreamResult {
  const variables: MetricStreamSubscriptionVariables = {
    clusterID: clusterID ?? "",
    metric,
    jobId: jobId ?? null,
  }

  const [result] = useSubscription<
    MetricStreamSubscription,
    MetricStreamSubscription,
    MetricStreamSubscriptionVariables
  >({
    query: METRIC_STREAM_DOCUMENT,
    variables,
    pause: !clusterID,
  })

  const evt = result.data?.metricStream
  return {
    value: evt?.value ?? null,
    timestamp: evt?.timestamp ?? null,
    error: !!result.error,
    loading: !result.data && !result.error,
  }
}
