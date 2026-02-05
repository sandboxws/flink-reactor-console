"use client";

import { use, useEffect } from "react";
import { useClusterStore } from "@/stores/cluster-store";
import { JobDetail } from "@/components/jobs/job-detail";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchX } from "lucide-react";

export default function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const initialize = useClusterStore((s) => s.initialize);
  const startPolling = useClusterStore((s) => s.startPolling);
  const stopPolling = useClusterStore((s) => s.stopPolling);
  const runningJobs = useClusterStore((s) => s.runningJobs);
  const completedJobs = useClusterStore((s) => s.completedJobs);
  const cancelJob = useClusterStore((s) => s.cancelJob);

  useEffect(() => {
    initialize();
    startPolling();
    return () => stopPolling();
  }, [initialize, startPolling, stopPolling]);

  const job =
    runningJobs.find((j) => j.id === id) ??
    completedJobs.find((j) => j.id === id);

  if (!job) {
    return <EmptyState icon={SearchX} message={`Job ${id} not found`} />;
  }

  return (
    <JobDetail
      job={job}
      onCancelJob={() => cancelJob(job.id)}
    />
  );
}
