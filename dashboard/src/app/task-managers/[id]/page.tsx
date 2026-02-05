"use client";

import { use, useEffect } from "react";
import { useClusterStore } from "@/stores/cluster-store";
import { TaskManagerDetail } from "@/components/task-managers/task-manager-detail";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchX } from "lucide-react";

export default function TaskManagerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const initialize = useClusterStore((s) => s.initialize);
  const startPolling = useClusterStore((s) => s.startPolling);
  const stopPolling = useClusterStore((s) => s.stopPolling);
  const taskManagers = useClusterStore((s) => s.taskManagers);

  useEffect(() => {
    initialize();
    startPolling();
    return () => stopPolling();
  }, [initialize, startPolling, stopPolling]);

  const tm = taskManagers.find((t) => t.id === id);

  if (!tm) {
    return (
      <EmptyState icon={SearchX} message="Task Manager not found" />
    );
  }

  return <TaskManagerDetail tm={tm} />;
}
