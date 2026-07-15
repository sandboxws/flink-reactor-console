import { MemoryChart } from "../components/redis/memory-chart"
import { ServerDashboard } from "../components/redis/server-dashboard"

export function RedisServerRoute({ instrumentName }: { instrumentName: string }) {
  return (
    <div className="space-y-4">
      <ServerDashboard instrumentName={instrumentName} />
      <MemoryChart instrumentName={instrumentName} />
    </div>
  )
}
