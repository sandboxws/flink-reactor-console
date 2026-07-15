import { ValueInspector } from "../components/redis/value-inspector"

export function RedisKeyRoute({
  instrumentName,
  redisKey,
}: {
  instrumentName: string
  redisKey: string
}) {
  if (!redisKey) {
    return (
      <div className="glass-card p-4 text-sm text-zinc-500">
        No key selected. Browse keys to inspect a value.
      </div>
    )
  }
  return <ValueInspector instrumentName={instrumentName} redisKey={redisKey} />
}
