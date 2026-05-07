/**
 * Hub DSL editor — /hub/sandbox/editor.
 *
 * Mirrors `console-v2/sandbox.html` exactly:
 *   ┌── Hub topbar (provided by HubAppShell) ────────────────────────┐
 *   ├── Hub sidebar │ ┌── DSL sandbox header ──────────────────────┐ │
 *   │               │ │ title · version · scratch · status · btns  │ │
 *   │               │ ├────────────┬─────────────┬─────────────────┤ │
 *   │               │ │ scratch    │ editor +    │ validation +    │ │
 *   │               │ │ pads,      │ preview     │ simulate +      │ │
 *   │               │ │ templates, │ tabs        │ AI assist       │ │
 *   │               │ │ imports    │             │                 │ │
 *   │               │ └────────────┴─────────────┴─────────────────┘ │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * The 3-column workspace runs full-bleed inside main (escaping the
 * default `px-8 py-6` padding via `<PageFullBleed>`); the Hub topbar
 * and sidebar from `<HubAppShell>` remain visible.
 */

import { createFileRoute } from "@tanstack/react-router"
import { DslEditorPane } from "@/components/hub/tools/dsl-editor-pane"
import { DslSandboxHeader } from "@/components/hub/tools/dsl-sandbox-header"
import { DslSandboxRail } from "@/components/hub/tools/dsl-sandbox-rail"
import { DslSandboxSidebar } from "@/components/hub/tools/dsl-sandbox-sidebar"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { PageFullBleed } from "@/lib/hub/page-full-bleed"

function HubSandboxEditor() {
  return (
    <HubAppShell>
      <PageFullBleed>
        <DslSandboxHeader />
        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px]">
          <DslSandboxSidebar />
          <DslEditorPane />
          <DslSandboxRail />
        </div>
      </PageFullBleed>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/sandbox/editor")({
  component: HubSandboxEditor,
})
