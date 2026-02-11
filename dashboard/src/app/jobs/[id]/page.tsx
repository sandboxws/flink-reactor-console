"use client";

import { use, useEffect } from "react";
import { useClusterStore } from "@/stores/cluster-store";
import { JobDetail } from "@/components/jobs/job-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

function JobDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header skeleton */}
      <div className="glass-card flex items-center gap-4 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-20" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      {/* Content skeleton */}
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
}

export default function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const fetchJobDetailAction = useClusterStore((s) => s.fetchJobDetail);
  const clearJobDetail = useClusterStore((s) => s.clearJobDetail);
  const cancelJob = useClusterStore((s) => s.cancelJob);
  const jobDetail = useClusterStore((s) => s.jobDetail);
  const jobDetailLoading = useClusterStore((s) => s.jobDetailLoading);
  const jobDetailError = useClusterStore((s) => s.jobDetailError);

  useEffect(() => {
    fetchJobDetailAction(id);
    return () => clearJobDetail();
  }, [id, fetchJobDetailAction, clearJobDetail]);

  if (jobDetailLoading && !jobDetail) {
    return <JobDetailSkeleton />;
  }

  if (jobDetailError && !jobDetail) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load job detail</AlertTitle>
          <AlertDescription>{jobDetailError}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchJobDetailAction(id)}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!jobDetail) {
    return <JobDetailSkeleton />;
  }

  return (
    <JobDetail
      job={jobDetail}
      onCancelJob={() => cancelJob(jobDetail.id)}
    />
  );
}
