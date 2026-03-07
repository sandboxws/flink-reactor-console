import { Activity, Database, Radio, Users } from "lucide-react"
import type { ActiveTapSession } from "@/stores/sql-gateway-store"

interface TapStatusBarProps {
  totalRowCount: number
  rowsPerSecond: number
  bufferSize: number
  currentBufferCount: number
  status: ActiveTapSession["status"] | "idle"
  consumerGroupId: string
}

export function TapStatusBar({
  totalRowCount,
  rowsPerSecond,
  bufferSize,
  currentBufferCount,
  status,
  consumerGroupId,
}: TapStatusBarProps) {
  const bufferPercent =
    bufferSize > 0 ? Math.round((currentBufferCount / bufferSize) * 100) : 0

  return (
    <div className="flex items-center gap-4 border-t border-dash-border bg-dash-surface/50 px-3 py-1.5 text-[10px] font-medium text-zinc-500">
      {/* Row count */}
      <div className="flex items-center gap-1.5" title="Total rows received">
        <Database className="size-3" />
        <span className="tabular-nums text-zinc-300">
          {totalRowCount.toLocaleString()}
        </span>
        <span>rows</span>
      </div>

      {/* Throughput */}
      <div className="flex items-center gap-1.5" title="Current throughput">
        <Activity className="size-3" />
        <span className="tabular-nums text-zinc-300">
          ~{rowsPerSecond.toLocaleString()}
        </span>
        <span>rows/s</span>
      </div>

      {/* Buffer usage */}
      <div className="flex items-center gap-1.5" title="Buffer usage">
        <Radio className="size-3" />
        <span className="tabular-nums text-zinc-300">
          {currentBufferCount.toLocaleString()} / {bufferSize.toLocaleString()}
        </span>
        <span>({bufferPercent}%)</span>
      </div>

      {/* Consumer group */}
      <div
        className="ml-auto flex items-center gap-1.5 truncate"
        title={consumerGroupId}
      >
        <Users className="size-3 shrink-0" />
        <span className="max-w-[300px] truncate font-mono text-zinc-400">
          {consumerGroupId || "—"}
        </span>
      </div>

      {/* Connection status / error */}
      {status === "error" && (
        <div className="ml-2 flex items-center gap-1 text-job-failed">
          <span className="inline-flex size-1.5 rounded-full bg-job-failed" />
          Error
        </div>
      )}
    </div>
  )
}
