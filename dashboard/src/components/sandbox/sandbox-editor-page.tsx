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

export function SandboxEditorPage() {
  const code = useSandboxStore((s) => s.code)
  const setCode = useSandboxStore((s) => s.setCode)
  const synthesize = useSandboxStore((s) => s.synthesize)

  return (
    <div className="flex h-full flex-col">
      <ResizablePanelGroup
        orientation="horizontal"
        id="sandbox-panels"
        className="flex-1"
      >
        {/* ── Examples sidebar ────────────────────────────────── */}
        <ResizablePanel
          defaultSize={18}
          minSize={14}
          maxSize={28}
          id="sandbox-sidebar"
        >
          <div className="h-full overflow-hidden border-r border-dash-border bg-dash-panel/50">
            <SandboxSidebar />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* ── Code editor ────────────────────────────────────── */}
        <ResizablePanel defaultSize={42} minSize={25} id="sandbox-editor">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-dash-border px-4 py-2">
              <span className="text-xs font-medium text-zinc-400">
                Editor
              </span>
              <span className="text-[10px] text-zinc-600">
                Cmd+Enter to synthesize
              </span>
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

        {/* ── Output panel ───────────────────────────────────── */}
        <ResizablePanel defaultSize={40} minSize={20} id="sandbox-output">
          <div className="flex h-full flex-col">
            <div className="border-b border-dash-border px-4 py-2">
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

      {/* ── Status bar ─────────────────────────────────────── */}
      <SandboxStatusBar />
    </div>
  )
}
