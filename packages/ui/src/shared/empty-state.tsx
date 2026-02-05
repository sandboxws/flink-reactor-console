"use client";

import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  message?: string;
}

/**
 * EmptyState — centered placeholder for empty content areas.
 */
export function EmptyState({
  icon: Icon = Inbox,
  message = "No data to display",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
      <Icon className="size-8 opacity-40" />
      <p className="text-xs">{message}</p>
    </div>
  );
}
