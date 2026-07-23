/**
 * Async-profiler (FLIP-375) data helpers — sibling to `flamegraph-data.ts`.
 *
 * These drive Flink's built-in JVM async profiler, which is deliberately
 * distinct from the operator flame graph (`fetchFlamegraph`): trigger a run on
 * a TaskManager or the JobManager in a chosen event mode, poll it to a terminal
 * state, and open the resulting interactive flame graph. The operator flame
 * graph samples one operator's on/off-CPU stacks; the async profiler profiles
 * the whole JVM — CPU, allocation pressure, lock contention, or wall-clock.
 *
 * The backend resolvers proxy Flink's `POST/GET /{taskmanagers/:id|jobmanager}
 * /profiler` endpoints and return a Console-proxied `downloadUrl` for finished
 * runs, so the browser never contacts Flink directly.
 */

import { gql } from "urql"
import { graphqlClient } from "./graphql-client"

export type ProfilerMode = "ITIMER" | "CPU" | "ALLOC" | "LOCK" | "WALL"
export type ProfilerStatus = "RUNNING" | "FINISHED" | "FAILED"

export interface ProfilerInstance {
  id: string
  status: ProfilerStatus
  mode: ProfilerMode
  /** Requested profiling window, in seconds. */
  duration: number
  /** Failure reason; present when status is FAILED. */
  message?: string | null
  /** Flame-graph file name; present when status is FINISHED. */
  outputFile?: string | null
  /** Console-proxied URL to open the flame graph; present when FINISHED. */
  downloadUrl?: string | null
}

const TRIGGER_TASK_MANAGER_PROFILER = gql`
  mutation TriggerTaskManagerProfiler(
    $id: ID!
    $mode: ProfilerMode!
    $duration: Int!
    $cluster: String
  ) {
    triggerTaskManagerProfiler(
      id: $id
      mode: $mode
      duration: $duration
      cluster: $cluster
    ) {
      id
      status
      mode
      duration
      message
      outputFile
      downloadUrl
    }
  }
`

const TRIGGER_JOB_MANAGER_PROFILER = gql`
  mutation TriggerJobManagerProfiler(
    $mode: ProfilerMode!
    $duration: Int!
    $cluster: String
  ) {
    triggerJobManagerProfiler(mode: $mode, duration: $duration, cluster: $cluster) {
      id
      status
      mode
      duration
      message
      outputFile
      downloadUrl
    }
  }
`

const TASK_MANAGER_PROFILER_INSTANCES = gql`
  query TaskManagerProfilerInstances($id: ID!, $cluster: String) {
    taskManagerProfilerInstances(id: $id, cluster: $cluster) {
      id
      status
      mode
      duration
      message
      outputFile
      downloadUrl
    }
  }
`

const JOB_MANAGER_PROFILER_INSTANCES = gql`
  query JobManagerProfilerInstances($cluster: String) {
    jobManagerProfilerInstances(cluster: $cluster) {
      id
      status
      mode
      duration
      message
      outputFile
      downloadUrl
    }
  }
`

export async function triggerTaskManagerProfiler(
  id: string,
  mode: ProfilerMode,
  duration: number,
  cluster?: string,
): Promise<ProfilerInstance> {
  const res = await graphqlClient
    .mutation(
      TRIGGER_TASK_MANAGER_PROFILER,
      { id, mode, duration, cluster },
      { requestPolicy: "network-only" },
    )
    .toPromise()
  if (res.error) throw new Error(res.error.message)
  const inst = res.data?.triggerTaskManagerProfiler
  if (!inst) throw new Error("Empty profiler trigger response")
  return inst as ProfilerInstance
}

export async function triggerJobManagerProfiler(
  mode: ProfilerMode,
  duration: number,
  cluster?: string,
): Promise<ProfilerInstance> {
  const res = await graphqlClient
    .mutation(
      TRIGGER_JOB_MANAGER_PROFILER,
      { mode, duration, cluster },
      { requestPolicy: "network-only" },
    )
    .toPromise()
  if (res.error) throw new Error(res.error.message)
  const inst = res.data?.triggerJobManagerProfiler
  if (!inst) throw new Error("Empty profiler trigger response")
  return inst as ProfilerInstance
}

export async function listTaskManagerProfilerInstances(
  id: string,
  cluster?: string,
): Promise<ProfilerInstance[]> {
  const res = await graphqlClient
    .query(
      TASK_MANAGER_PROFILER_INSTANCES,
      { id, cluster },
      { requestPolicy: "network-only" },
    )
    .toPromise()
  if (res.error) throw new Error(res.error.message)
  return (res.data?.taskManagerProfilerInstances ?? []) as ProfilerInstance[]
}

export async function listJobManagerProfilerInstances(
  cluster?: string,
): Promise<ProfilerInstance[]> {
  const res = await graphqlClient
    .query(
      JOB_MANAGER_PROFILER_INSTANCES,
      { cluster },
      { requestPolicy: "network-only" },
    )
    .toPromise()
  if (res.error) throw new Error(res.error.message)
  return (res.data?.jobManagerProfilerInstances ?? []) as ProfilerInstance[]
}

/**
 * Rebase a server-relative `/api/logs/...` download URL onto the reactor-server
 * origin so it opens correctly whether the dashboard is served by the Go server
 * (prod, same origin → relative) or by Vite in dev (origin differs → absolute).
 * Mirrors the JAR-upload / log-fetch base-URL derivation in graphql-api-client.
 */
export function absoluteProfilerDownloadUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  const base = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace("/graphql", "")
  return `${base}${url}`
}

const TERMINAL: ProfilerStatus[] = ["FINISHED", "FAILED"]

export interface PollOptions {
  intervalMs?: number
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * Poll `list` until the instance matching `id` reaches a terminal state
 * (FINISHED or FAILED), then resolve it. Rejects on timeout or abort.
 *
 * Matching is by `id`, which the backend derives from Flink's output file name
 * (assigned at trigger time), so it is stable across a run's RUNNING → FINISHED
 * transitions.
 */
export async function pollProfilerInstance(
  list: () => Promise<ProfilerInstance[]>,
  id: string,
  opts: PollOptions = {},
): Promise<ProfilerInstance> {
  const intervalMs = opts.intervalMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 180_000
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError")

    const found = (await list()).find((i) => i.id === id)
    if (found && TERMINAL.includes(found.status)) return found

    if (Date.now() >= deadline) {
      throw new Error("Profiler run timed out before completing")
    }
    await delay(intervalMs, opts.signal)
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true },
    )
  })
}
