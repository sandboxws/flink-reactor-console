import { Info } from "lucide-react"

export function ClusterInfo({
  version,
  commitId,
}: {
  version: string
  commitId: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-dash-elevated/50 px-4 py-2 text-xs text-zinc-500">
      <Info className="size-3.5 shrink-0" />
      <span>
        Flink <span className="font-medium text-zinc-300">{version}</span>
      </span>
      <span className="text-dash-border">|</span>
      <span className="font-mono">{commitId.slice(0, 7)}</span>
    </div>
  )
}
