import { createFileRoute, Navigate } from "@tanstack/react-router"

function TemplatesIndex() {
  return <Navigate to="/templates/overview" />
}

export const Route = createFileRoute("/templates/")({
  component: TemplatesIndex,
})
