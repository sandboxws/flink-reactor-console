"use client";

import { useEffect } from "react";
import { useClusterStore } from "@/stores/cluster-store";
import { SubmitJobPage } from "@/components/jobs/submit-job-page";

export default function SubmitPage() {
  const initialize = useClusterStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <SubmitJobPage />;
}
