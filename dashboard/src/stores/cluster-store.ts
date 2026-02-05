import { create } from "zustand";
import type {
  ClusterOverview,
  FlinkJob,
  JobManagerInfo,
  SubmitJobRequest,
  TaskManager,
  UploadedJar,
} from "@/data/cluster-types";
import { pickRandom } from "@/data/flink-loggers";
import {
  generateClusterOverview,
  generateCompletedJobs,
  generateJobManagerInfo,
  generateRunningJobs,
  generateTaskManagers,
  generateUploadedJars,
  refreshMetrics,
} from "@/data/mock-cluster";

// ---------------------------------------------------------------------------
// Cluster store — cluster state with polling-based refresh
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
}

interface ClusterActions {
  initialize: () => void;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => void;
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

  initialize: () => {
    if (initialized) return;
    initialized = true;

    const tms = generateTaskManagers();
    const running = generateRunningJobs();
    const completed = generateCompletedJobs();
    const jm = generateJobManagerInfo();
    const jars = generateUploadedJars();
    const overview = generateClusterOverview(running, completed, tms);

    set({
      taskManagers: tms,
      runningJobs: running,
      completedJobs: completed,
      jobManager: jm,
      uploadedJars: jars,
      overview,
      lastUpdated: new Date(),
    });
  },

  startPolling: () => {
    if (pollInterval) return;
    pollInterval = setInterval(() => {
      get().refresh();
    }, 5000);
    set({ isPolling: true });
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    set({ isPolling: false });
  },

  refresh: () => {
    const { runningJobs, completedJobs, taskManagers, jobManager } = get();
    if (!jobManager) return;

    // Apply metric deltas
    refreshMetrics(taskManagers, jobManager, runningJobs);

    // Occasionally transition a running job to completed (~5% chance per refresh)
    const updatedRunning = [...runningJobs];
    let updatedCompleted = [...completedJobs];

    if (updatedRunning.length > 1 && Math.random() < 0.05) {
      const idx = Math.floor(Math.random() * updatedRunning.length);
      const job = { ...updatedRunning[idx] };
      job.status = pickRandom(["FINISHED", "FINISHED", "FAILED"]);
      job.endTime = new Date();
      job.duration = Date.now() - job.startTime.getTime();
      updatedRunning.splice(idx, 1);
      updatedCompleted = [job, ...updatedCompleted];
    }

    const overview = generateClusterOverview(
      updatedRunning,
      updatedCompleted,
      taskManagers,
    );

    set({
      runningJobs: updatedRunning,
      completedJobs: updatedCompleted,
      taskManagers: [...taskManagers],
      jobManager: { ...jobManager },
      overview,
      lastUpdated: new Date(),
    });
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
