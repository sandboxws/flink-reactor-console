import { create } from "zustand";
import type {
  ClusterOverview,
  FlinkJob,
  JobManagerInfo,
  SubmitJobRequest,
  TaskManager,
  UploadedJar,
} from "@/data/cluster-types";
import {
  generateClusterOverview,
  generateJobManagerInfo,
  generateTaskManagers,
  generateUploadedJars,
  refreshMetrics,
} from "@/data/mock-cluster";
import { fetchOverviewPageData } from "@/lib/flink-api-client";
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
}

interface ClusterActions {
  initialize: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
  selectTaskManager: (id: string | null) => void;
  selectJob: (id: string | null) => void;
  submitJob: (request: SubmitJobRequest) => void;
  cancelJob: (jobId: string) => void;
  uploadJar: (jar: UploadedJar) => void;
  deleteJar: (jarId: string) => void;
}

export type ClusterStore = ClusterState & ClusterActions;

let pollInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function hex(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

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

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    // Generate mock data for pages not yet wired to the API
    const tms = generateTaskManagers();
    const jm = generateJobManagerInfo();
    const jars = generateUploadedJars();

    set({
      taskManagers: tms,
      jobManager: jm,
      uploadedJars: jars,
      isLoading: true,
      fetchError: null,
    });

    try {
      const data = await fetchOverviewPageData();
      set({
        overview: data.overview,
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
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
    // Refresh mock TM/JM metrics (pages not yet on the API)
    const { taskManagers, jobManager, runningJobs } = get();
    if (jobManager) {
      refreshMetrics(taskManagers, jobManager, runningJobs);
    }

    try {
      const data = await fetchOverviewPageData();
      set({
        overview: data.overview,
        runningJobs: data.runningJobs,
        completedJobs: data.completedJobs,
        fetchError: null,
        lastUpdated: new Date(),
        // Spread refreshed mock data so Zustand detects the change
        taskManagers: [...taskManagers],
        jobManager: jobManager ? { ...jobManager } : null,
      });
    } catch (err) {
      // Keep stale data visible — only set the error
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch cluster data",
        // Still update mock TM/JM refs so those pages refresh
        taskManagers: [...taskManagers],
        jobManager: jobManager ? { ...jobManager } : null,
      });
    }
  },

  selectTaskManager: (id) => {
    set({ selectedTaskManagerId: id });
  },

  selectJob: (id) => {
    set({ selectedJobId: id });
  },

  submitJob: (request) => {
    const { runningJobs, taskManagers, completedJobs } = get();
    const name = request.entryClass.split(".").pop() ?? "UnknownJob";

    const newJob: FlinkJob = {
      id: hex(32),
      name,
      status: "RUNNING",
      startTime: new Date(),
      endTime: null,
      duration: 0,
      tasks: {
        pending: 0,
        running: request.parallelism,
        finished: 0,
        canceling: 0,
        failed: 0,
      },
      parallelism: request.parallelism,
      plan: null,
      exceptions: [],
      checkpoints: [],
      checkpointConfig: null,
      subtaskMetrics: {},
      configuration: [],
    };

    const updatedRunning = [newJob, ...runningJobs];
    const overview = generateClusterOverview(
      updatedRunning,
      completedJobs,
      taskManagers,
    );

    set({
      runningJobs: updatedRunning,
      overview,
      lastUpdated: new Date(),
    });
  },

  cancelJob: (jobId) => {
    const { runningJobs, completedJobs, taskManagers } = get();
    const idx = runningJobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return;

    const job = { ...runningJobs[idx] };
    job.status = "CANCELED";
    job.endTime = new Date();
    job.duration = Date.now() - job.startTime.getTime();

    const updatedRunning = runningJobs.filter((_, i) => i !== idx);
    const updatedCompleted = [job, ...completedJobs];
    const overview = generateClusterOverview(
      updatedRunning,
      updatedCompleted,
      taskManagers,
    );

    set({
      runningJobs: updatedRunning,
      completedJobs: updatedCompleted,
      overview,
      lastUpdated: new Date(),
    });
  },

  uploadJar: (jar) => {
    set((state) => ({ uploadedJars: [...state.uploadedJars, jar] }));
  },

  deleteJar: (jarId) => {
    set((state) => ({
      uploadedJars: state.uploadedJars.filter((j) => j.id !== jarId),
    }));
  },
}));
