import { useLayoutEffect } from "react"
import { usePanelRef } from "react-resizable-panels"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useFilteredLogs } from "@/lib/hooks"
import { useUiStore } from "@/stores/ui-store"
import { LogDetailPanel } from "./log-detail-panel"
import { LogHistogram } from "./log-histogram"
import { LogList } from "./log-list"
import { LogToolbar } from "./log-toolbar"

const DETAIL_PANEL_DEFAULT_PX = 360

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
