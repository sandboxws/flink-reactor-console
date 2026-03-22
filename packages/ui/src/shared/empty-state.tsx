"use client"

import { Inbox } from "lucide-react"

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  message?: string
  title?: string
  description?: string
  children?: React.ReactNode
}

/**
 * EmptyState — centered placeholder for empty content areas.
 *
 * Simple usage: `<EmptyState message="No jobs found" />`
 * Rich usage:  `<EmptyState icon={Search} title="No results" description="Try adjusting your filters"><Button>Clear filters</Button></EmptyState>`
 */
export function EmptyState({
  icon: Icon = Inbox,
  message,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
      <Icon className="size-8 opacity-40" />
      {title && <p className="text-sm font-medium text-zinc-300">{title}</p>}
      {(message || (!title && !description)) && (
        <p className="text-xs">{message ?? "No data to display"}</p>
      )}
      {description && <p className="max-w-sm text-center text-xs">{description}</p>}
      {children && <div className="mt-2 flex gap-2">{children}</div>}
    </div>
  )
}
