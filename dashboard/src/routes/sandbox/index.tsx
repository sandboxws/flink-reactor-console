import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Route: /sandbox — Sandbox landing page, redirects to the editor. */
export const Route = createFileRoute("/sandbox/")({
  component: () => <Navigate to="/sandbox/editor" />,
})
