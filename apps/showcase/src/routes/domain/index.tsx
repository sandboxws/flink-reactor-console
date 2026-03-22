import { createFileRoute, Navigate } from "@tanstack/react-router"

function DomainIndex() {
  return <Navigate to="/domain/overview" />
}

export const Route = createFileRoute("/domain/")({ component: DomainIndex })
