/**
 * @module log-explorer
 *
 * Top-level log explorer page implementing a resizable master-detail layout.
 * The left panel contains the toolbar, histogram, and virtualized log list;
 * the right panel shows the detail view for the currently selected entry.
 * Panel visibility is driven by {@link useUiStore} so selection and
 * deselection automatically expand/collapse the detail pane.
 */

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@flink-reactor/ui"
import { useLayoutEffect } from "react"
import { usePanelRef } from "react-resizable-panels"
import { useFilteredLogs } from "@/lib/hooks"
import { useUiStore } from "@/stores/ui-store"
import { LogDetailPanel } from "./log-detail-panel"
import { LogHistogram } from "./log-histogram"
import { LogList } from "./log-list"
import { LogToolbar } from "./log-toolbar"

/** Default width in pixels for the detail panel when it opens. */
const DETAIL_PANEL_DEFAULT_PX = 360

/**
 * Log explorer page with resizable master-detail layout.
 *
 * Subscribes to {@link useUiStore} for detail panel open/close state
 * and uses `usePanelRef` to imperatively resize the detail panel.
 * When the user drags the detail panel fully closed, it auto-deselects
 * the active log entry to keep UI state consistent.
 */
export function LogExplorer() {
  const filteredLogs = useFilteredLogs()
  const detailPanelOpen = useUiStore((s) => s.detailPanelOpen)
  const detailRef = usePanelRef()

  useLayoutEffect(() => {
    const panel = detailRef.current
    if (!panel) return

    if (detailPanelOpen) {
      panel.resize(DETAIL_PANEL_DEFAULT_PX)
    } else {
      panel.collapse()
    }
  }, [detailPanelOpen, detailRef])

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel minSize="30%">
        <div className="flex h-full flex-col overflow-hidden">
          <LogToolbar filteredCount={filteredLogs.length} />
          <LogHistogram entries={filteredLogs} />
          <LogList entries={filteredLogs} />
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel
        panelRef={detailRef}
        defaultSize={0}
        minSize={280}
        maxSize={720}
        collapsible
        collapsedSize={0}
        onResize={(panelSize) => {
          if (panelSize.inPixels === 0) {
            const store = useUiStore.getState()
            if (store.detailPanelOpen) {
              store.setSelectedEntryId(null)
            }
          }
        }}
      >
        <LogDetailPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
