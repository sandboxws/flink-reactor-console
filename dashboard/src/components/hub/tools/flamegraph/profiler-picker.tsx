/**
 * ProfilerPicker — pick a running job and one of its vertices, then
 * render the Hub flame graph for the selected pair. Used by the Hub
 * Job Manager Profiler tab and the Hub TaskManager detail Profiler tab.
 *
 * If `vertexFilter` is supplied (TM-detail case), the vertex picker is
 * pre-filtered to vertices that have at least one subtask running on
 * that TM.
 */

import { Activity } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchJobDetail } from "@/lib/graphql-api-client"
import { useClusterStore } from "@/stores/cluster-store"
import { HubFlamegraphPanel } from "./hub-flamegraph-panel"

interface ProfilerPickerProps {
  /** Optional predicate that filters which vertices the picker should
   *  show — e.g., only vertices that have a subtask running on a given
   *  TaskManager. Defaults to "all vertices". */
  vertexFilter?: (vertexId: string) => boolean
}

export function ProfilerPicker({ vertexFilter }: ProfilerPickerProps) {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const runningJobs = useClusterStore((s) => s.runningJobs)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  const [jobId, setJobId] = useState<string>("")
  const [vertices, setVertices] = useState<{ id: string; name: string }[]>([])
  const [vertexId, setVertexId] = useState<string>("")
  const [loadingVertices, setLoadingVertices] = useState(false)
  const [vertexErr, setVertexErr] = useState<string | null>(null)

  // Default to first running job
  useEffect(() => {
    if (!jobId && runningJobs.length > 0) setJobId(runningJobs[0].id)
  }, [jobId, runningJobs])

  // Fetch vertices when jobId changes
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    setLoadingVertices(true)
    setVertexErr(null)
    fetchJobDetail(jobId)
      .then((j) => {
        if (cancelled) return
        const all = j.vertices?.map((v) => ({ id: v.id, name: v.name })) ?? []
        const filtered = vertexFilter
          ? all.filter((v) => vertexFilter(v.id))
          : all
        setVertices(filtered)
        if (filtered.length > 0) setVertexId(filtered[0].id)
        else setVertexId("")
      })
      .catch((e) => {
        if (!cancelled) {
          setVertexErr(
            e instanceof Error ? e.message : "Failed to load vertices",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingVertices(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId, vertexFilter])

  const hasJobs = runningJobs.length > 0

  if (!hasJobs) {
    return (
      <div className="glass-card-static p-8 text-center">
        <Activity className="mx-auto size-6 text-fr-coral/60" />
        <p className="mt-3 text-[12px] text-fg-muted">
          No running jobs to profile. Start a job first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass-card-static flex flex-wrap items-end gap-3 p-3">
        <PickerSelect
          label="Job"
          value={jobId}
          onChange={(v) => {
            setJobId(v)
            setVertexId("")
          }}
          options={runningJobs.map((j) => ({ value: j.id, label: j.name }))}
        />
        <PickerSelect
          label="Vertex"
          value={vertexId}
          onChange={setVertexId}
          options={vertices.map((v) => ({ value: v.id, label: v.name }))}
          placeholder={loadingVertices ? "Loading…" : "Pick a vertex"}
          disabled={!jobId || loadingVertices || vertices.length === 0}
        />
      </div>

      {vertexErr ? (
        <p className="text-[11.5px] text-fr-rose font-mono">{vertexErr}</p>
      ) : null}

      {jobId && vertexId ? (
        <div className="glass-card-static p-4">
          <HubFlamegraphPanel jobId={jobId} vertexId={vertexId} />
        </div>
      ) : (
        <p className="text-[12px] text-fg-muted">
          Pick a job and vertex to view the flame graph.
        </p>
      )}
    </div>
  )
}

function PickerSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-dash-border bg-dash-panel px-2 py-1 font-mono text-[11.5px] text-fg disabled:opacity-60"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
