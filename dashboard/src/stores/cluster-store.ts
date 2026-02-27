import { create } from "zustand";
import type {
  ClusterOverview,
  FlinkFeatureFlags,
  FlinkJob,
  JobManagerInfo,
  SubmitJobRequest,
  TaskManager,
  UploadedJar,
} from "@/data/cluster-types";
// mock-cluster import removed — all data now comes from API
import {
  fetchOverviewPageData,
  fetchJobDetail,
  fetchTaskManagers,
  fetchTaskManagerDetail,
  fetchJobManagerDetail,
  fetchClusterConfig,
  cancelJob as cancelJobApi,
  fetchJars,
  uploadJar as uploadJarApi,
  deleteJar as deleteJarApi,
  runJar as runJarApi,
} from "@/lib/flink-api-client";
import { useConfigStore } from "./config-store";

// ---------------------------------------------------------------------------
// Cluster store — cluster state with API-backed polling refresh
// ---------------------------------------------------------------------------

interface ClusterState {
  overview: ClusterOverview | null;
  runningJobs: FlinkJob[];
  completedJobs: FlinkJob[];
  taskManagers: TaskManager[];
  jobManager: JobManagerInfo | null;
  uploadedJars: UploadedJar[];
  selectedTaskManagerId: string | null;
  selectedJobId: string | null;
  isPolling: boolean;
  lastUpdated: Date | null;
  fetchError: string | null;
  isLoading: boolean;
  jobDetail: FlinkJob | null;
  jobDetailLoading: boolean;
  jobDetailError: string | null;
  taskManagerDetail: TaskManager | null;
  taskManagerDetailLoading: boolean;
  taskManagerDetailError: string | null;
  featureFlags: FlinkFeatureFlags | null;
}

interface ClusterActions {
  initialize: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
  selectTaskManager: (id: string | null) => void;
  selectJob: (id: string | null) => void;
  submitJob: (request: SubmitJobRequest) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  uploadJar: (file: File) => Promise<void>;
  deleteJar: (jarId: string) => Promise<void>;
  fetchJars: () => Promise<void>;
  fetchJobDetail: (jobId: string) => Promise<void>;
  clearJobDetail: () => void;
  fetchTaskManagerDetail: (tmId: string) => Promise<void>;
  clearTaskManagerDetail: () => void;
}

export type ClusterStore = ClusterState & ClusterActions;

let pollInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;

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

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    set({
      isLoading: true,
      fetchError: null,
    });

    try {
      // Fetch overview + TM list + JM detail + feature flags + JARs in parallel
      const [data, tms, jm, flags, jars] = await Promise.all([
        fetchOverviewPageData(),
        fetchTaskManagers(),
        fetchJobManagerDetail(),
        fetchClusterConfig(),
        fetchJars(),
      ]);
      set({
        overview: data.overview,
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
        taskManagers: tms,
        jobManager: jm,
        featureFlags: flags,
        uploadedJars: jars,
        isLoading: false,
        fetchError: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      set({
        isLoading: false,
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch cluster data",
      });
    }
  },

  startPolling: () => {
    if (pollInterval) return;
    const intervalMs =
      useConfigStore.getState().config?.pollIntervalMs ?? 5000;
    pollInterval = setInterval(() => {
      get().refresh();
    }, intervalMs);
    set({ isPolling: true });
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    set({ isPolling: false });
  },

  refresh: async () => {
    try {
      // Refresh overview + jobs + TM list in parallel
      const [data, tms] = await Promise.all([
        fetchOverviewPageData(),
        fetchTaskManagers(),
      ]);
      set({
        overview: data.overview,
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
        taskManagers: tms,
        fetchError: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      // Keep stale data visible — only set the error
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch cluster data",
      });
    }
  },

  selectTaskManager: (id) => {
    set({ selectedTaskManagerId: id });
  },

  selectJob: (id) => {
    set({ selectedJobId: id });
  },

  submitJob: async (request) => {
    try {
      await runJarApi(request.jarId, {
        entryClass: request.entryClass,
        parallelism: request.parallelism,
        programArgs: request.programArgs || undefined,
        savepointPath: request.savepointPath,
        allowNonRestoredState: request.allowNonRestoredState,
      });
      // Re-fetch to get updated job list
      await get().refresh();
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to submit job",
      });
    }
  },

  cancelJob: async (jobId) => {
    try {
      await cancelJobApi(jobId);
      // Re-fetch to get updated job states
      await get().refresh();
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to cancel job",
      });
    }
  },

  uploadJar: async (file) => {
    try {
      const jars = await uploadJarApi(file);
      set({ uploadedJars: jars });
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to upload JAR",
      });
    }
  },

  deleteJar: async (jarId) => {
    try {
      await deleteJarApi(jarId);
      // Re-fetch JAR list
      const jars = await fetchJars();
      set({ uploadedJars: jars });
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to delete JAR",
      });
    }
  },

  fetchJars: async () => {
    try {
      const jars = await fetchJars();
      set({ uploadedJars: jars });
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch JARs",
      });
    }
  },

  fetchJobDetail: async (jobId) => {
    set({ jobDetailLoading: true, jobDetailError: null });
    try {
      const job = await fetchJobDetail(jobId);
      set({ jobDetail: job, jobDetailLoading: false, jobDetailError: null });
    } catch (err) {
      set({
        jobDetailLoading: false,
        jobDetailError:
          err instanceof Error ? err.message : "Failed to fetch job detail",
      });
    }
  },

  clearJobDetail: () => {
    set({ jobDetail: null, jobDetailLoading: false, jobDetailError: null });
  },

  fetchTaskManagerDetail: async (tmId) => {
    set({ taskManagerDetailLoading: true, taskManagerDetailError: null });
    try {
      const tm = await fetchTaskManagerDetail(tmId);
      set({
        taskManagerDetail: tm,
        taskManagerDetailLoading: false,
        taskManagerDetailError: null,
      });
    } catch (err) {
      set({
        taskManagerDetailLoading: false,
        taskManagerDetailError:
          err instanceof Error
            ? err.message
            : "Failed to fetch task manager detail",
      });
    }
  },

  clearTaskManagerDetail: () => {
    set({
      taskManagerDetail: null,
      taskManagerDetailLoading: false,
      taskManagerDetailError: null,
    });
  },
}));
