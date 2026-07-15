import { createFileRoute } from "@tanstack/react-router"
import { ValueInspector } from "@/components/instruments/redis/value-inspector"

type KeySearch = {
  key: string
}

/** Route: /instruments/$instrumentName/redis/key — Redis key value inspector via search params. */
export const Route = createFileRoute("/instruments/$instrumentName/redis/key")({
  validateSearch: (search: Record<string, unknown>): KeySearch => ({
    key: (search.key as string) ?? "",
  }),
  component: () => {
    const { instrumentName } = Route.useParams()
    const { key } = Route.useSearch()
    if (!key) {
      return (
        <div className="glass-card p-4 text-sm text-zinc-500">
          No key selected. Browse keys to inspect a value.
        </div>
      )
    }
    return <ValueInspector instrumentName={instrumentName} redisKey={key} />
  },
})
