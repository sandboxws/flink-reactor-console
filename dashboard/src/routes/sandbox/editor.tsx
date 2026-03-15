import { createFileRoute } from "@tanstack/react-router"
import { SandboxEditorPage } from "@/components/sandbox/sandbox-editor-page"

export const Route = createFileRoute("/sandbox/editor")({
  component: SandboxEditorPage,
})
