import { useState, useRef, useCallback } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { SandboxEditor } from "./sandbox-editor"
import { SandboxSidebar } from "./sandbox-sidebar"
import { SandboxStatusBar } from "./sandbox-status-bar"
import { SynthesisOutput } from "./synthesis-output"
import { useSandboxStore } from "@/stores/sandbox-store"

// ---------------------------------------------------------------------------
// Resizable secondary sidebar — vanilla mouse events, no library
// Mirrors the pattern from reactor-md's SecondarySidebar.
// ---------------------------------------------------------------------------

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 380
const SIDEBAR_DEFAULT = 240

function SecondarySidebar({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT)
  const isResizing = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      const startX = e.clientX
      const startWidth = width

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return
        const delta = moveEvent.clientX - startX
        setWidth(
          Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta)),
        )
      }

      const handleMouseUp = () => {
        isResizing.current = false
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [width],
  )

  return (
    <div
      className="relative flex shrink-0 flex-col border-r border-dash-border bg-dash-panel/50"
      style={{ width }}
    >
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      <div
        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors hover:bg-fr-purple/60 active:bg-fr-purple/80"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function SandboxEditorPage() {
  const code = useSandboxStore((s) => s.code)
  const setCode = useSandboxStore((s) => s.setCode)
  const synthesize = useSandboxStore((s) => s.synthesize)

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* ── Examples sidebar (custom resize) ──────────────── */}
        <SecondarySidebar>
          <SandboxSidebar />
        </SecondarySidebar>

        {/* ── Editor + Output (library resize) ─────────────── */}
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex h-9 items-center justify-between border-b border-dash-border px-4">
                <span className="text-xs font-medium text-zinc-400">
                  Editor
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600">
                    Cmd+Enter
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={synthesize}
                    className="h-6 gap-1.5 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    <Play className="size-3" />
                    Synthesize
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <SandboxEditor
                  value={code}
                  onChange={setCode}
                  onSynthesize={synthesize}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="flex h-full flex-col">
              <div className="flex h-9 items-center border-b border-dash-border px-4">
                <span className="text-xs font-medium text-zinc-400">
                  Output
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <SynthesisOutput />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ── Status bar ─────────────────────────────────────── */}
      <SandboxStatusBar />
    </div>
  )
}
