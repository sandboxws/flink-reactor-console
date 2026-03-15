import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/sandbox/")({
  component: () => <Navigate to="/sandbox/editor" />,
})
