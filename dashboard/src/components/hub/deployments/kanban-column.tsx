/**
 * Linear-style kanban column.
 *
 * Header has a `<StatusIcon>`, name, count, and a placeholder overflow menu.
 * Body holds card children; an `.add-card` footer renders below the cards
 * (non-functional in v1 — clicking shows a toast directing to the CLI).
 *
 * When the column has zero cards, render a centered empty state rather
 * than empty whitespace, to satisfy the "never-empty rail/column" rule.
 */

import { StatusIcon, type StatusIconState } from "@flink-reactor/ui"
import { CheckCircle2, MoreHorizontal, Plus } from "lucide-react"

interface KanbanColumnProps {
  state: StatusIconState
  name: string
  count: number
  emptyMessage: string
  children: React.ReactNode
  onAdd?: () => void
}

export function KanbanColumn({
  state,
  name,
  count,
  emptyMessage,
  children,
  onAdd,
}: KanbanColumnProps) {
  const empty = count === 0
  return (
    <div className="kanban-col">
      <div className="kanban-col-header">
        <StatusIcon state={state} />
        <span className="text-[12.5px] text-fg">{name}</span>
        <span className="font-mono text-[11px] text-fg-faint">{count}</span>
        <button
          type="button"
          className="ml-auto text-fg-faint hover:text-fr-coral"
          aria-label={`${name} column actions`}
          onClick={(e) => e.preventDefault()}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </div>
      <div className="kanban-col-body space-y-2">
        {empty ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <CheckCircle2 className="size-4 text-fr-sage" />
            <span className="text-[11px] font-mono text-fg-faint">
              {emptyMessage}
            </span>
          </div>
        ) : (
          children
        )}
      </div>
      <button
        type="button"
        className="add-card"
        onClick={onAdd}
        aria-label={`Add deployment to ${name}`}
      >
        <Plus className="size-3.5" />
        Add deployment
      </button>
    </div>
  )
}
