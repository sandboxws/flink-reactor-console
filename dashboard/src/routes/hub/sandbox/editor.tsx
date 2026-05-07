/**
 * Hub DSL editor — /hub/sandbox/editor.
 *
 * Full-bleed 2-column layout: CodeMirror DSL editor on the left, live
 * synthesis (SQL / CRD / plan) on the right. Both panes read/write a
 * shared `useSandboxStore`; the editor debounces synthesis at ~300ms
 * (handled inside `<SandboxEditor>`).
 */

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { DslEditorPane } from "@/components/hub/tools/dsl-editor-pane"
import { PlanGraphPreview } from "@/components/hub/tools/plan-graph-preview"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { PageFullBleed } from "@/lib/hub/page-full-bleed"

function HubSandboxEditor() {
  return (
    <HubAppShell>
      <PageFullBleed>
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={50} minSize={30}>
            <DslEditorPane />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={25}>
            <PlanGraphPreview />
          </ResizablePanel>
        </ResizablePanelGroup>
      </PageFullBleed>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/sandbox/editor")({
  component: HubSandboxEditor,
})
