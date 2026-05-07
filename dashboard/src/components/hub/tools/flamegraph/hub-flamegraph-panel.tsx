/**
 * HubFlamegraphPanel — fetches a flame graph for (jobId, vertexId, type)
 * and renders it via `<HubFlamegraph>` with a small toolbar (type
 * selector + refresh + last-fetched timestamp).
 *
 * Used by both the Hub job-manager Profiler tab and the Hub task-manager
 * detail Profiler tab. They share this implementation since the
 * underlying `flamegraph` query is the same.
 */

import { format } from "date-fns"
import { Activity, RefreshCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { type FlamegraphResult, fetchFlamegraph } from "@/lib/flamegraph-data"
import { HubFlamegraph } from "./hub-flamegraph"

type ProfileType = "ON_CPU" | "OFF_CPU" | "FULL"

interface HubFlamegraphPanelProps {
  jobId: string
  vertexId: string
  cluster?: string
}

export function HubFlamegraphPanel({
  jobId,
  vertexId,
  cluster,
}: HubFlamegraphPanelProps) {
  const [type, setType] = useState<ProfileType>("ON_CPU")
  const [result, setResult] = useState<FlamegraphResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchFlamegraph(jobId, vertexId, type, cluster)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch flame graph")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const endTs = result ? Number(result.endTimestamp) : 0
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Activity className="size-4 text-fr-coral" />
        <h3 className="font-sans text-[13.5px] font-medium text-zinc-100">
          Flame graph
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ProfileType)}
            className="rounded-md border border-dash-border bg-dash-panel px-2 py-1 font-mono text-[11px] text-fg"
          >
            <option value="ON_CPU">On-CPU</option>
            <option value="OFF_CPU">Off-CPU</option>
            <option value="FULL">Full</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            aria-label="Refresh flame graph"
          >
            <RefreshCcw className="size-3" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 font-mono text-[11.5px] text-fg">
          {error}
        </div>
      ) : null}

      {loading && !result ? (
        <p className="text-[11.5px] font-mono text-fg-faint">
          Sampling… (Flink takes ~5s to gather a sample)
        </p>
      ) : null}

      {result ? (
        <>
          <HubFlamegraph data={result.data} />
          {endTs > 0 ? (
            <p className="font-mono text-[10px] text-fg-faint">
              Sample window ended {format(new Date(endTs), "PP p")}
            </p>
          ) : null}
        </>
      ) : !loading && !error ? (
        <p className="text-[12px] text-fg-muted">No samples yet.</p>
      ) : null}
    </div>
  )
}
