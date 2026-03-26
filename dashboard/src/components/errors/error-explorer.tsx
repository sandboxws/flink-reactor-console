/**
 * @module error-explorer
 *
 * Top-level error explorer page implementing a master-detail layout.
 * The left column displays the grouped error list with sort controls;
 * the right column shows an occurrence timeline and full error detail
 * for the selected group. Errors are automatically grouped by exception
 * class in {@link useErrorStore} as they are detected in the log stream.
 */

import { AlertTriangle } from "lucide-react"
import { useMemo } from "react"
import { EmptyState } from "@flink-reactor/ui"
import { useErrorStore } from "@/stores/error-store"
import { ErrorDetail } from "./error-detail"
import { ErrorGroupList } from "./error-group-list"
import { ErrorTimeline } from "./error-timeline"

/**
 * Error explorer page with master-detail layout.
 *
 * Left column: scrollable list of {@link ErrorGroup} cards with sort controls.
 * Right column: occurrence timeline chart and full error detail panel for the
 * selected group. Shows an empty state when no exceptions have been recorded.
 */
export function ErrorExplorer() {
  const groupsMap = useErrorStore((s) => s.groups)
  const selectedGroupId = useErrorStore((s) => s.selectedGroupId)

  const groups = useMemo(() => Array.from(groupsMap.values()), [groupsMap])

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        message="No exceptions recorded yet. Errors will appear here as they are detected in the log stream."
      />
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: Error group list */}
      <div className="w-80 shrink-0 border-r border-dash-border overflow-hidden">
        <ErrorGroupList groups={groups} />
      </div>

      {/* Right: Detail + timeline */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedGroup ? (
          <>
            {/* Timeline header */}
            <div className="border-b border-dash-border bg-dash-surface p-3">
              <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Occurrence Timeline
              </h3>
              <ErrorTimeline occurrences={selectedGroup.occurrences} />
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-auto">
              <ErrorDetail group={selectedGroup} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-zinc-600">
              Select an error group to view details
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
