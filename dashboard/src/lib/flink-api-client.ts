// ---------------------------------------------------------------------------
// Browser-side API client — fetches from Next.js proxy routes, applies mappers.
// ---------------------------------------------------------------------------

import type {
  CheckpointDetail,
  CheckpointSubtaskStats,
  ClusterOverview,
  FlamegraphData,
  FlinkFeatureFlags,
  FlinkJob,
  JobManagerInfo,
  LogFileEntry,
  SubtaskTimeline,
  TaskManager,
  TaskManagerMetrics,
  ThreadDumpInfo,
  UploadedJar,
} from "@/data/cluster-types"
import {
  mapCheckpointDetail,
  mapCheckpointSubtaskDetail,
  mapClusterConfig,
  mapFlamegraph,
  mapJars,
  mapJobDetailAggregate,
  mapJobManagerDetail,
  mapJobManagerMetrics,
  mapJobsOverviewResponse,
  mapLogFileList,
  mapOverviewResponse,
  mapSubtaskTimes,
  mapTaskManagerDetail,
  mapTaskManagerMetrics,
  mapTaskManagers,
  mapThreadDump,
} from "@/data/flink-api-mappers"
import type {
  FlinkCheckpointDetailResponse,
  FlinkCheckpointSubtaskDetailResponse,
  FlinkClusterConfigResponse,
  FlinkFlamegraphResponse,
  FlinkJarRunResponse,
  FlinkJarsResponse,
  FlinkJobDetailAggregate,
  FlinkJobManagerDetailAggregate,
  FlinkJobsOverviewResponse,
  FlinkLogListResponse,
  FlinkMetricItem,
  FlinkOverviewResponse,
  FlinkSubtaskTimesResponse,
  FlinkTaskManagerDetailAggregate,
  FlinkTaskManagersResponse,
  FlinkThreadDumpResponse,
} from "@/data/flink-api-types"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `API request failed: ${res.status}`
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`)
  }
  return res.text()
}

// ---------------------------------------------------------------------------
// Overview + Jobs
// ---------------------------------------------------------------------------

export async function fetchClusterOverview(): Promise<ClusterOverview> {
  const raw = await fetchJson<FlinkOverviewResponse>("/api/flink/overview")
  return mapOverviewResponse(raw)
}

export async function fetchJobsOverview(): Promise<{
  runningJobs: FlinkJob[]
  completedJobs: FlinkJob[]
}> {
  const raw = await fetchJson<FlinkJobsOverviewResponse>(
    "/api/flink/jobs/overview",
  )
  return mapJobsOverviewResponse(raw)
}

export type OverviewPageData = {
  overview: ClusterOverview
  runningJobs: FlinkJob[]
  completedJobs: FlinkJob[]
}

export async function fetchOverviewPageData(): Promise<OverviewPageData> {
  const [overview, jobs] = await Promise.all([
    fetchClusterOverview(),
    fetchJobsOverview(),
  ])

  return {
    overview,
    runningJobs: jobs.runningJobs,
    completedJobs: jobs.completedJobs,
  }
}

export async function fetchJobDetail(jobId: string): Promise<FlinkJob> {
  const raw = await fetchJson<FlinkJobDetailAggregate>(
    `/api/flink/jobs/${jobId}/detail`,
  )
  return mapJobDetailAggregate(raw)
}

// ---------------------------------------------------------------------------
// Task Manager endpoints
// ---------------------------------------------------------------------------

export async function fetchTaskManagers(): Promise<TaskManager[]> {
  const raw = await fetchJson<FlinkTaskManagersResponse>(
    "/api/flink/taskmanagers",
  )
  return mapTaskManagers(raw)
}

export async function fetchTaskManagerDetail(
  tmId: string,
): Promise<TaskManager> {
  const raw = await fetchJson<FlinkTaskManagerDetailAggregate>(
    `/api/flink/taskmanagers/${tmId}/detail`,
  )
  return mapTaskManagerDetail(raw)
}

const TM_METRIC_IDS = [
  "Status.JVM.CPU.Load",
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Committed",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Committed",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
].join(",")

export async function fetchTaskManagerMetrics(
  tmId: string,
): Promise<TaskManagerMetrics> {
  const raw = await fetchJson<FlinkMetricItem[]>(
    `/api/flink/taskmanagers/${tmId}/metrics?get=${TM_METRIC_IDS}`,
  )
  return mapTaskManagerMetrics(raw)
}

export async function fetchTaskManagerLog(tmId: string): Promise<string> {
  return fetchText(`/api/flink/taskmanagers/${tmId}/log`)
}

export async function fetchTaskManagerStdout(tmId: string): Promise<string> {
  return fetchText(`/api/flink/taskmanagers/${tmId}/stdout`)
}

export async function fetchTaskManagerLogs(
  tmId: string,
): Promise<LogFileEntry[]> {
  const raw = await fetchJson<FlinkLogListResponse>(
    `/api/flink/taskmanagers/${tmId}/logs`,
  )
  return mapLogFileList(raw)
}

export async function fetchTaskManagerLogFile(
  tmId: string,
  logName: string,
): Promise<string> {
  return fetchText(
    `/api/flink/taskmanagers/${tmId}/logs/${encodeURIComponent(logName)}`,
  )
}

export async function fetchTaskManagerThreadDump(
  tmId: string,
): Promise<ThreadDumpInfo> {
  const raw = await fetchJson<FlinkThreadDumpResponse>(
    `/api/flink/taskmanagers/${tmId}/thread-dump`,
  )
  return mapThreadDump(raw)
}

// ---------------------------------------------------------------------------
// Job Manager endpoints
// ---------------------------------------------------------------------------

export async function fetchJobManagerDetail(): Promise<JobManagerInfo> {
  const raw = await fetchJson<FlinkJobManagerDetailAggregate>(
    "/api/flink/jobmanager/detail",
  )
  return mapJobManagerDetail(raw)
}

const JM_METRIC_IDS = [
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Memory.Direct.MemoryUsed",
  "Status.JVM.Memory.Direct.TotalCapacity",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
].join(",")

export async function fetchJobManagerMetrics(): Promise<{
  heapUsed: number
  heapMax: number
  nonHeapUsed: number
  nonHeapMax: number
  threadCount: number
  gcCount: number
  gcTime: number
}> {
  const raw = await fetchJson<FlinkMetricItem[]>(
    `/api/flink/jobmanager/metrics?get=${JM_METRIC_IDS}`,
  )
  return mapJobManagerMetrics(raw)
}

export async function fetchJobManagerLog(): Promise<string> {
  return fetchText("/api/flink/jobmanager/log")
}

export async function fetchJobManagerStdout(): Promise<string> {
  return fetchText("/api/flink/jobmanager/stdout")
}

export async function fetchJobManagerLogs(): Promise<LogFileEntry[]> {
  const raw = await fetchJson<FlinkLogListResponse>(
    "/api/flink/jobmanager/logs",
  )
  return mapLogFileList(raw)
}

export async function fetchJobManagerLogFile(logName: string): Promise<string> {
  return fetchText(`/api/flink/jobmanager/logs/${encodeURIComponent(logName)}`)
}

export async function fetchJobManagerThreadDump(): Promise<ThreadDumpInfo> {
  const raw = await fetchJson<FlinkThreadDumpResponse>(
    "/api/flink/jobmanager/thread-dump",
  )
  return mapThreadDump(raw)
}

// ---------------------------------------------------------------------------
// Cluster config / feature flags
// ---------------------------------------------------------------------------

export async function fetchClusterConfig(): Promise<FlinkFeatureFlags> {
  const raw = await fetchJson<FlinkClusterConfigResponse>("/api/flink/config")
  return mapClusterConfig(raw)
}

// ---------------------------------------------------------------------------
// Job actions
// ---------------------------------------------------------------------------

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/flink/jobs/${jobId}/cancel`, {
    method: "PATCH",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `Failed to cancel job: ${res.status}`
    throw new Error(message)
  }
}

// ---------------------------------------------------------------------------
// Vertex metrics
// ---------------------------------------------------------------------------

const VERTEX_METRIC_IDS = [
  "numRecordsInPerSecond",
  "numRecordsOutPerSecond",
  "numBytesInPerSecond",
  "numBytesOutPerSecond",
  "busyTimeMsPerSecond",
  "backPressuredTimeMsPerSecond",
  "idleTimeMsPerSecond",
  "currentInputWatermark",
].join(",")

export async function fetchVertexMetrics(
  jobId: string,
  vertexId: string,
): Promise<FlinkMetricItem[]> {
  return fetchJson<FlinkMetricItem[]>(
    `/api/flink/jobs/${jobId}/vertices/${vertexId}/metrics?get=${VERTEX_METRIC_IDS}`,
  )
}

// ---------------------------------------------------------------------------
// Generic metric browsing (Metrics Explorer)
// ---------------------------------------------------------------------------

export async function fetchMetricList(proxyUrl: string): Promise<string[]> {
  const raw = await fetchJson<FlinkMetricItem[]>(proxyUrl)
  return raw.map((item) => item.id)
}

export async function fetchMetricValues(
  proxyUrl: string,
  metricIds: string[],
): Promise<Record<string, number>> {
  const separator = proxyUrl.includes("?") ? "&" : "?"
  const raw = await fetchJson<FlinkMetricItem[]>(
    `${proxyUrl}${separator}get=${metricIds.join(",")}`,
  )
  const result: Record<string, number> = {}
  for (const item of raw) {
    const parsed = parseFloat(item.value)
    if (!Number.isNaN(parsed)) {
      result[item.id] = parsed
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Checkpoint detail
// ---------------------------------------------------------------------------

export async function fetchCheckpointDetail(
  jobId: string,
  checkpointId: number,
): Promise<CheckpointDetail> {
  const raw = await fetchJson<FlinkCheckpointDetailResponse>(
    `/api/flink/jobs/${jobId}/checkpoints/${checkpointId}/detail`,
  )
  return mapCheckpointDetail(raw)
}

export async function fetchCheckpointSubtaskDetail(
  jobId: string,
  checkpointId: number,
  vertexId: string,
): Promise<CheckpointSubtaskStats[]> {
  const raw = await fetchJson<FlinkCheckpointSubtaskDetailResponse>(
    `/api/flink/jobs/${jobId}/checkpoints/${checkpointId}/subtasks/${vertexId}`,
  )
  return mapCheckpointSubtaskDetail(raw)
}

// ---------------------------------------------------------------------------
// Subtask times
// ---------------------------------------------------------------------------

export async function fetchSubtaskTimes(
  jobId: string,
  vertexId: string,
): Promise<SubtaskTimeline> {
  const raw = await fetchJson<FlinkSubtaskTimesResponse>(
    `/api/flink/jobs/${jobId}/vertices/${vertexId}/subtasktimes`,
  )
  return mapSubtaskTimes(raw)
}

// ---------------------------------------------------------------------------
// Flamegraph
// ---------------------------------------------------------------------------

export async function fetchFlamegraph(
  jobId: string,
  vertexId: string,
  type: "full" | "on_cpu" | "off_cpu" = "full",
): Promise<FlamegraphData> {
  const raw = await fetchJson<FlinkFlamegraphResponse>(
    `/api/flink/jobs/${jobId}/vertices/${vertexId}/flamegraph?type=${type}`,
  )
  return mapFlamegraph(raw)
}

// ---------------------------------------------------------------------------
// JAR management
// ---------------------------------------------------------------------------

export async function fetchJars(): Promise<UploadedJar[]> {
  const raw = await fetchJson<FlinkJarsResponse>("/api/flink/jars")
  return mapJars(raw)
}

export async function uploadJar(file: File): Promise<UploadedJar[]> {
  const formData = new FormData()
  formData.append("jarfile", file)
  const res = await fetch("/api/flink/jars", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `Failed to upload JAR: ${res.status}`
    throw new Error(message)
  }
  // Re-fetch the JAR list to get the full entry with entry classes
  return fetchJars()
}

export async function deleteJar(jarId: string): Promise<void> {
  const res = await fetch(`/api/flink/jars/${encodeURIComponent(jarId)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `Failed to delete JAR: ${res.status}`
    throw new Error(message)
  }
}

export async function runJar(
  jarId: string,
  options: {
    entryClass?: string
    parallelism?: number
    programArgs?: string
    savepointPath?: string | null
    allowNonRestoredState?: boolean
  },
): Promise<string> {
  const body: Record<string, unknown> = {}
  if (options.entryClass) body["entry-class"] = options.entryClass
  if (options.parallelism) body.parallelism = options.parallelism
  if (options.programArgs) body["program-args"] = options.programArgs
  if (options.savepointPath) body.savepointPath = options.savepointPath
  if (options.allowNonRestoredState)
    body.allowNonRestoredState = options.allowNonRestoredState

  const res = await fetch(`/api/flink/jars/${encodeURIComponent(jarId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    const message =
      errBody && typeof errBody === "object" && "error" in errBody
        ? String((errBody as { error: string }).error)
        : `Failed to run JAR: ${res.status}`
    throw new Error(message)
  }
  const raw = (await res.json()) as FlinkJarRunResponse
  return raw.jobid
}
