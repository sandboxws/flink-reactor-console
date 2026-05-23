/**
 * useClusterSavepoints — fan-out across all running jobs to collect savepoints.
 *
 * Issues one `savepoints(jobId)` query per running job and merges the results
 * client-side, sorted by `triggeredAt` descending. Each row is decorated with
 * the originating job's name + id so the Hub checkpoints page can render a
 * unified table.
 *
 * The fan-out is acceptable at v1 cluster sizes; a future change can add an
 * aggregated `clusterSavepoints` query if measured cardinality requires it.
 */

import type { FlinkJob } from "@flink-reactor/ui"
import { useEffect, useRef, useState } from "react"
import {
  fetchJobSavepoints,
  type JobSavepoint,
} from "@/lib/graphql-api-client"

export interface SavepointRow extends JobSavepoint {
  jobId: string
  jobName: string
}

export interface ClusterSavepointsResult {
  rows: SavepointRow[]
  loading: boolean
  /** Most recent fetch error, if any (the fan-out fails open: partial results may still be returned). */
  error: string | null
}

/**
 * Fan out a savepoints query across the given running jobs.
 *
 * Pass `null` to disable fetching (e.g. before the cluster store has hydrated).
 * Each individual job's fetch is independent — one failure does not block the
 * others, matching the pattern used in the server-side `jobs` rate enrichment.
 */
export function useClusterSavepoints(
  runningJobs: FlinkJob[] | null,
  options: { refreshIntervalMs?: number } = {},
): ClusterSavepointsResult {
  const refreshMs = options.refreshIntervalMs ?? 15_000
  const [rows, setRows] = useState<SavepointRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stabilize the dependency on the jobs list — referencing job IDs by string
  // avoids re-running the effect on every cluster-store re-render when nothing
  // has actually changed.
  const jobsKey = runningJobs
    ? runningJobs
        .map((j) => `${j.id}:${j.name}`)
        .sort()
        .join("|")
    : ""
  const jobsRef = useRef<FlinkJob[] | null>(runningJobs)
  jobsRef.current = runningJobs

  useEffect(() => {
    if (runningJobs === null) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchAll() {
      const jobs = jobsRef.current
      if (!jobs || jobs.length === 0) {
        setRows([])
        setLoading(false)
        setError(null)
        return
      }

      const settled = await Promise.allSettled(
        jobs.map(async (job) => {
          const sps = await fetchJobSavepoints(job.id)
          return sps.map(
            (sp): SavepointRow => ({
              ...sp,
              jobId: job.id,
              jobName: job.name,
            }),
          )
        }),
      )
      if (cancelled) return

      const flat: SavepointRow[] = []
      const failures: string[] = []
      for (const r of settled) {
        if (r.status === "fulfilled") {
          flat.push(...r.value)
        } else {
          failures.push(String(r.reason))
        }
      }
      flat.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())

      setRows(flat)
      setError(failures.length > 0 ? failures[0] : null)
      setLoading(false)
    }

    fetchAll()
    const id = window.setInterval(fetchAll, refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // jobsKey changes when the set of running jobs changes; refreshMs change
    // is rare but supported. Disabling exhaustive-deps because we read jobs
    // through jobsRef to avoid identity churn.
  }, [jobsKey, refreshMs, runningJobs])

  return { rows, loading, error }
}
