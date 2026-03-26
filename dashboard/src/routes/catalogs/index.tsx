import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Route: /catalogs — Catalog index, redirects to the available catalogs view. */
export const Route = createFileRoute("/catalogs/")({
  component: () => <Navigate to="/catalogs/available" />,
})
