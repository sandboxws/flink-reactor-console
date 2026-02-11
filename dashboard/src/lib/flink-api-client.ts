// ---------------------------------------------------------------------------
// Browser-side API client — fetches from Next.js proxy routes, applies mappers.
// ---------------------------------------------------------------------------

import type { FlinkOverviewResponse, FlinkJobsOverviewResponse } from "@/data/flink-api-types";
import { mapOverviewResponse, mapJobsOverviewResponse } from "@/data/flink-api-mappers";
import type { ClusterOverview, FlinkJob } from "@/data/cluster-types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `API request failed: ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchClusterOverview(): Promise<ClusterOverview> {
  const raw = await fetchJson<FlinkOverviewResponse>("/api/flink/overview");
  return mapOverviewResponse(raw);
}

export async function fetchJobsOverview(): Promise<{
  runningJobs: FlinkJob[];
  completedJobs: FlinkJob[];
}> {
  const raw = await fetchJson<FlinkJobsOverviewResponse>("/api/flink/jobs/overview");
  return mapJobsOverviewResponse(raw);
}

export type OverviewPageData = {
  overview: ClusterOverview;
  runningJobs: FlinkJob[];
  completedJobs: FlinkJob[];
};

export async function fetchOverviewPageData(): Promise<OverviewPageData> {
  const [overview, jobs] = await Promise.all([
    fetchClusterOverview(),
    fetchJobsOverview(),
  ]);

  return {
    overview,
    runningJobs: jobs.runningJobs,
    completedJobs: jobs.completedJobs,
  };
}
