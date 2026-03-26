import { create } from "zustand"
import type {
  ClusterOverview,
  FlinkFeatureFlags,
  FlinkJob,
  JobManagerInfo,
  SubmitJobRequest,
  TaskManager,
  UploadedJar,
} from "@flink-reactor/ui"
import {
  cancelJob as cancelJobApi,
  deleteJar as deleteJarApi,
  fetchClusterConfig,
  fetchJars,
  fetchJobDetail,
  fetchJobManagerDetail,
  fetchOverviewPageData,
  fetchTapManifests,
  fetchTaskManagerDetail,
  fetchTaskManagers,
  runJar as runJarApi,
  stopJobWithSavepoint as stopJobWithSavepointApi,
  triggerSavepoint as triggerSavepointApi,
  uploadJar as uploadJarApi,
} from "@/lib/graphql-api-client"
import { useConfigStore } from "./config-store"

/**
 * Cluster store — central state for the Flink cluster dashboard.
 *
 * Fetches overview, job list, task managers, job manager, JARs, and feature
 * flags from the Go GraphQL backend on initialization. Supports configurable
 * polling (interval from config-store) to keep the UI in sync with the cluster.
 *
 * @module cluster-store
 */

interface ClusterState {
  /** Cluster-wide stats: version, slots, job counts, Flink commit hash. */
  overview: ClusterOverview | null
  /** Jobs in a running bucket (RUNNING, CREATED, RESTARTING, RECONCILING). */
  runningJobs: FlinkJob[]
  /** Jobs in a terminal state (FINISHED, FAILED, CANCELED, SUSPENDED). */
  completedJobs: FlinkJob[]
  /** All registered task managers in the cluster. */
  taskManagers: TaskManager[]
  /** Job manager detail (host, port, log URL, metrics). */
  jobManager: JobManagerInfo | null
  /** JARs uploaded to the cluster, available for job submission. */
  uploadedJars: UploadedJar[]
  /** Currently selected task manager ID (for detail view navigation). */
  selectedTaskManagerId: string | null
  /** Currently selected job ID (for detail view navigation). */
  selectedJobId: string | null
  /** Whether the periodic refresh interval is active. */
  isPolling: boolean
  /** Timestamp of the last successful data refresh. */
  lastUpdated: Date | null
  /** Error message from the most recent failed fetch (stale data stays visible). */
  fetchError: string | null
  /** True during the initial data load before any data is available. */
  isLoading: boolean
  /** Lazily loaded full job detail (vertices, plan, checkpoints, config). */
  jobDetail: FlinkJob | null
  /** Whether a job detail fetch is in progress. */
  jobDetailLoading: boolean
  /** Error from the most recent job detail fetch. */
  jobDetailError: string | null
  /** Lazily loaded task manager detail (metrics, logs, thread dump). */
  taskManagerDetail: TaskManager | null
  /** Whether a task manager detail fetch is in progress. */
  taskManagerDetailLoading: boolean
  /** Error from the most recent task manager detail fetch. */
  taskManagerDetailError: string | null
  /** Feature flags derived from the Flink cluster configuration. */
  featureFlags: FlinkFeatureFlags | null
  /** Pipeline names that have tap manifests (support tapping). */
  tappablePipelines: Set<string>
}

interface ClusterActions {
  /** Fetch all cluster data once (guarded — subsequent calls are no-ops). */
  initialize: () => Promise<void>
  /** Start periodic refresh at the interval configured in config-store. */
  startPolling: () => void
  /** Stop the periodic refresh interval. */
  stopPolling: () => void
  /** Re-fetch overview, jobs, and task managers (called by polling and on-demand). */
  refresh: () => Promise<void>
  /** Set the selected task manager for detail view navigation. */
  selectTaskManager: (id: string | null) => void
  /** Set the selected job for detail view navigation. */
  selectJob: (id: string | null) => void
  /** Submit a job from an uploaded JAR and refresh the job list. */
  submitJob: (request: SubmitJobRequest) => Promise<void>
  /** Cancel a running job and optimistically mark it as CANCELLING. */
  cancelJob: (jobId: string) => Promise<void>
  /** Trigger an async savepoint for a running job. */
  triggerSavepoint: (jobId: string) => Promise<void>
  /** Stop a job with a savepoint and refresh the job list. */
  stopWithSavepoint: (jobId: string) => Promise<void>
  /** Stop all running jobs with savepoints (best-effort, continues on failure). */
  stopAllJobs: () => Promise<void>
  /** Upload a JAR file to the cluster and update the jar list. */
  uploadJar: (file: File) => Promise<void>
  /** Delete an uploaded JAR and re-fetch the jar list. */
  deleteJar: (jarId: string) => Promise<void>
  /** Re-fetch the list of uploaded JARs. */
  fetchJars: () => Promise<void>
  /** Lazily fetch full job detail (vertices, plan, checkpoints, config). */
  fetchJobDetail: (jobId: string) => Promise<void>
  /** Clear the lazily loaded job detail state. */
  clearJobDetail: () => void
  /** Lazily fetch full task manager detail (metrics, logs, thread dump). */
  fetchTaskManagerDetail: (tmId: string) => Promise<void>
  /** Clear the lazily loaded task manager detail state. */
  clearTaskManagerDetail: () => void
}

export type ClusterStore = ClusterState & ClusterActions

let pollInterval: ReturnType<typeof setInterval> | null = null
let initialized = false

export const useClusterStore = create<ClusterStore>((set, get) => ({
  overview: null,
  runningJobs: [],
  completedJobs: [],
  taskManagers: [],
  jobManager: null,
  uploadedJars: [],
  selectedTaskManagerId: null,
  selectedJobId: null,
  isPolling: false,
  lastUpdated: null,
  fetchError: null,
  isLoading: false,
  jobDetail: null,
  jobDetailLoading: false,
  jobDetailError: null,
  taskManagerDetail: null,
  taskManagerDetailLoading: false,
  taskManagerDetailError: null,
  featureFlags: null,
  tappablePipelines: new Set(),

  initialize: async () => {
    if (initialized) return
    initialized = true

    set({
      isLoading: true,
      fetchError: null,
    })

    try {
      // Fetch overview + TM list + JM detail + feature flags + JARs + tappable pipelines in parallel
      const [data, tms, jm, flags, jars, tappable] = await Promise.all([
        fetchOverviewPageData(),
        fetchTaskManagers(),
        fetchJobManagerDetail(),
        fetchClusterConfig(),
        fetchJars(),
        // Discover which pipelines have tap manifests (non-critical — falls back to empty)
        fetchTapManifests()
          .then((manifests) => new Set(manifests.map((m) => m.name)))
          .catch(() => new Set<string>()),
      ])
      set({
        overview: data.overview,
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
        taskManagers: tms,
        jobManager: jm,
        featureFlags: flags,
        uploadedJars: jars,
        tappablePipelines: tappable,
        isLoading: false,
        fetchError: null,
        lastUpdated: new Date(),
      })
    } catch (err) {
      set({
        isLoading: false,
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch cluster data",
      })
    }
  },

  startPolling: () => {
    if (pollInterval) return
    const intervalMs = useConfigStore.getState().config?.pollIntervalMs ?? 5000
    pollInterval = setInterval(() => {
      get().refresh()
    }, intervalMs)
    set({ isPolling: true })
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    set({ isPolling: false })
  },

  refresh: async () => {
    try {
      // Refresh overview + jobs + TM list in parallel
      const [data, tms] = await Promise.all([
        fetchOverviewPageData(),
        fetchTaskManagers(),
      ])
      set({
        overview: data.overview,
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
        taskManagers: tms,
        fetchError: null,
        lastUpdated: new Date(),
      })
    } catch (err) {
      // Keep stale data visible — only set the error
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch cluster data",
      })
    }
  },

  selectTaskManager: (id) => {
    set({ selectedTaskManagerId: id })
  },

  selectJob: (id) => {
    set({ selectedJobId: id })
  },

  submitJob: async (request) => {
    try {
      await runJarApi(request.jarId, {
        entryClass: request.entryClass,
        parallelism: request.parallelism,
        programArgs: request.programArgs || undefined,
        savepointPath: request.savepointPath,
        allowNonRestoredState: request.allowNonRestoredState,
      })
      // Re-fetch to get updated job list
      await get().refresh()
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : "Failed to submit job",
      })
    }
  },

  cancelJob: async (jobId) => {
    try {
      await cancelJobApi(jobId)
      // Optimistically mark the job as CANCELLING so the UI updates
      // immediately — Flink's state transition takes time and the
      // refetch below may still return RUNNING.
      const current = get().jobDetail
      if (current && current.id === jobId) {
        set({ jobDetail: { ...current, status: "CANCELLING" } })
      }
      // Re-fetch overview + job detail in parallel so both the list and
      // the detail page reflect the actual state from Flink.
      await Promise.all([get().refresh(), get().fetchJobDetail(jobId)])
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : "Failed to cancel job",
      })
    }
  },

  triggerSavepoint: async (jobId) => {
    try {
      await triggerSavepointApi(jobId)
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to trigger savepoint",
      })
    }
  },

  stopWithSavepoint: async (jobId) => {
    try {
      await stopJobWithSavepointApi(jobId)
      await Promise.all([get().refresh(), get().fetchJobDetail(jobId)])
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : "Failed to stop job",
      })
    }
  },

  stopAllJobs: async () => {
    const jobs = get().runningJobs
    for (const job of jobs) {
      try {
        await stopJobWithSavepointApi(job.id)
      } catch {
        // Continue stopping other jobs even if one fails
      }
    }
    await get().refresh()
  },

  uploadJar: async (file) => {
    try {
      const jars = await uploadJarApi(file)
      set({ uploadedJars: jars })
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : "Failed to upload JAR",
      })
    }
  },

  deleteJar: async (jarId) => {
    try {
      await deleteJarApi(jarId)
      // Re-fetch JAR list
      const jars = await fetchJars()
      set({ uploadedJars: jars })
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : "Failed to delete JAR",
      })
    }
  },

  fetchJars: async () => {
    try {
      const jars = await fetchJars()
      set({ uploadedJars: jars })
    } catch (err) {
      set({
        fetchError: err instanceof Error ? err.message : "Failed to fetch JARs",
      })
    }
  },

  fetchJobDetail: async (jobId) => {
    set({ jobDetailLoading: true, jobDetailError: null })
    try {
      const job = await fetchJobDetail(jobId)
      set({ jobDetail: job, jobDetailLoading: false, jobDetailError: null })
    } catch (err) {
      set({
        jobDetailLoading: false,
        jobDetailError:
          err instanceof Error ? err.message : "Failed to fetch job detail",
      })
    }
  },

  clearJobDetail: () => {
    set({ jobDetail: null, jobDetailLoading: false, jobDetailError: null })
  },

  fetchTaskManagerDetail: async (tmId) => {
    set({ taskManagerDetailLoading: true, taskManagerDetailError: null })
    try {
      const tm = await fetchTaskManagerDetail(tmId)
      set({
        taskManagerDetail: tm,
        taskManagerDetailLoading: false,
        taskManagerDetailError: null,
      })
    } catch (err) {
      set({
        taskManagerDetailLoading: false,
        taskManagerDetailError:
          err instanceof Error
            ? err.message
            : "Failed to fetch task manager detail",
      })
    }
  },

  clearTaskManagerDetail: () => {
    set({
      taskManagerDetail: null,
      taskManagerDetailLoading: false,
      taskManagerDetailError: null,
    })
  },
}))
