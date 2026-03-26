import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/ — Instrument index, redirects to the database view. */
export const Route = createFileRoute("/instruments/$instrumentName/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <Navigate
        to="/instruments/$instrumentName/database"
        params={{ instrumentName }}
      />
    )
  },
})
