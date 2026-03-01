"use client";

import { useEffect } from "react";
import { AlertsDashboard } from "@/components/monitoring/alerts-dashboard";
import { useClusterStore } from "@/stores/cluster-store";
import { useAlertsStore } from "@/stores/alerts-store";

export default function AlertsPage() {
  const initCluster = useClusterStore((s) => s.initialize);
  const startClusterPolling = useClusterStore((s) => s.startPolling);
  const stopClusterPolling = useClusterStore((s) => s.stopPolling);
  const initAlerts = useAlertsStore((s) => s.initialize);
  const stopAlerts = useAlertsStore((s) => s.stopListening);

  useEffect(() => {
    initCluster();
    startClusterPolling();
    initAlerts();
    return () => {
      stopClusterPolling();
      stopAlerts();
    };
  }, [
    initCluster,
    startClusterPolling,
    stopClusterPolling,
    initAlerts,
    stopAlerts,
  ]);

  return <AlertsDashboard />;
}
