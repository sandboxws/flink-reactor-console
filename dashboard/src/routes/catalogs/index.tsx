import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/catalogs/")({
  component: () => <Navigate to="/catalogs/available" />,
})
