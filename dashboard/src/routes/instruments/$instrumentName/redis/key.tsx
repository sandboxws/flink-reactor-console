import { RedisKeyRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

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
    return <RedisKeyRoute instrumentName={instrumentName} redisKey={key} />
  },
})
