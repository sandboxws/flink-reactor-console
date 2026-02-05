"use client";

import { useEffect } from "react";
import { useClusterStore } from "@/stores/cluster-store";
import { OverviewPage } from "@/components/overview/overview-page";

export default function Overview() {
  const initialize = useClusterStore((s) => s.initialize);
  const startPolling = useClusterStore((s) => s.startPolling);
  const stopPolling = useClusterStore((s) => s.stopPolling);

  useEffect(() => {
    initialize();
    startPolling();
    return () => stopPolling();
  }, [initialize, startPolling, stopPolling]);

  return <OverviewPage />;
}
