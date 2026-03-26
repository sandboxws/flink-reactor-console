import { createFileRoute } from "@tanstack/react-router"
import { SandboxEditorPage } from "@/components/sandbox/sandbox-editor-page"

/** Route: /sandbox/editor — DSL editor with live preview, validation, and plan analysis. */
export const Route = createFileRoute("/sandbox/editor")({
  component: SandboxEditorPage,
})
