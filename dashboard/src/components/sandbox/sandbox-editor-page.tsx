import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { SandboxEditor } from "./sandbox-editor"
import { SandboxStatusBar } from "./sandbox-status-bar"
import { useSandboxStore } from "@/stores/sandbox-store"

export function SandboxEditorPage() {
  const code = useSandboxStore((s) => s.code)
  const setCode = useSandboxStore((s) => s.setCode)
  const synthesize = useSandboxStore((s) => s.synthesize)

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <ResizablePanelGroup orientation="horizontal" id="sandbox-editor-panels">
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="glass-card h-full overflow-hidden p-2">
            <SandboxEditor
              value={code}
              onChange={setCode}
              onSynthesize={synthesize}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="glass-card flex h-full items-center justify-center p-4">
            <span className="text-sm text-zinc-500">
              Output will appear here
            </span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <SandboxStatusBar />
    </div>
  )
}
