/**
 * Hub Sources & Sinks tab — restyles the legacy source/sink list with Hub
 * primitives (glass-card-static + SevBadge + LiveDot). Reads the pre-computed
 * `FlinkJob.sourcesAndSinks` array (already filtered by role; the backend
 * resolves connector detection via manifest / vertex_name / plan_node).
 */

import type { ConnectorType, FlinkJob, JobConnector } from "@flink-reactor/ui"
import { formatBytes, LiveDot, SevBadge } from "@flink-reactor/ui"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  FileText,
  HardDrive,
  Layers,
  type LucideIcon,
  MessageSquare,
  Unplug,
} from "lucide-react"
import { cn } from "@/lib/cn"

const CONNECTOR_ICONS: Record<ConnectorType, LucideIcon> = {
  kafka: MessageSquare,
  iceberg: Layers,
  paimon: HardDrive,
  jdbc: Database,
  filesystem: FileText,
  unknown: Database,
}

const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  kafka: "Kafka",
  iceberg: "Iceberg",
  paimon: "Paimon",
  jdbc: "JDBC",
  filesystem: "FileSystem",
  unknown: "Unknown",
}

/** Tone classes for the connector type icon chip (statically discoverable). */
const CONNECTOR_TONE: Record<ConnectorType, string> = {
  kafka: "text-fr-coral",
  iceberg: "text-fr-teal",
  paimon: "text-fr-sage",
  jdbc: "text-fr-violet",
  filesystem: "text-fr-amber",
  unknown: "text-fg-muted",
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function ConnectorCard({ c }: { c: JobConnector }) {
  const Icon = CONNECTOR_ICONS[c.connectorType] ?? Database
  const tone = CONNECTOR_TONE[c.connectorType] ?? "text-fg-muted"
  const label = CONNECTOR_LABELS[c.connectorType] ?? c.connectorType
  const isSource = c.role === "source"
  const records = c.metrics
    ? isSource
      ? c.metrics.recordsRead
      : c.metrics.recordsWritten
    : 0
  const bytes = c.metrics
    ? isSource
      ? c.metrics.bytesRead
      : c.metrics.bytesWritten
    : 0
  const flowing = records > 0

  return (
    <div className="glass-card-static flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-md bg-dash-panel border border-dash-border shrink-0",
              tone,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[13px] font-medium text-zinc-100 truncate">
                {label}
              </span>
              {flowing ? <LiveDot tone="sage" /> : null}
            </div>
            <div
              className="mt-0.5 font-mono text-[11px] text-fg-muted truncate"
              title={c.resource}
            >
              {c.resource || c.vertexName}
            </div>
          </div>
        </div>
        <SevBadge tone={isSource ? "info" : "warn"}>{c.role}</SevBadge>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-dash-border pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-fg-faint">
            {isSource ? "Records read" : "Records written"}
          </div>
          <div className="mt-0.5 font-mono text-[13px] tabular-nums text-zinc-100">
            {formatCount(records)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-fg-faint">
            {isSource ? "Bytes read" : "Bytes written"}
          </div>
          <div className="mt-0.5 font-mono text-[13px] tabular-nums text-zinc-100">
            {formatBytes(bytes)}
          </div>
        </div>
      </div>

      {c.confidence < 1.0 ? (
        <div className="text-[10px] font-mono text-fr-amber">
          {Math.round(c.confidence * 100)}% detection confidence · via{" "}
          {c.detectionMethod}
        </div>
      ) : null}
    </div>
  )
}

export function HubSourcesSinksTab({ job }: { job: FlinkJob }) {
  const sources = job.sourcesAndSinks.filter((c) => c.role === "source")
  const sinks = job.sourcesAndSinks.filter((c) => c.role === "sink")

  if (sources.length === 0 && sinks.length === 0) {
    return (
      <div className="glass-card-static flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Unplug className="size-7 text-fg-faint" />
        <p className="text-[13px] text-fg-muted">
          No sources or sinks detected for this job
        </p>
        <p className="font-mono text-[11px] text-fg-faint">
          Deploy with the FlinkReactor DSL to get structured connector detection
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {sources.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-fg-muted">
            <ArrowDownToLine className="size-3.5 text-fr-teal" />
            <span>Sources ({sources.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sources.map((c) => (
              <ConnectorCard key={c.vertexId} c={c} />
            ))}
          </div>
        </section>
      ) : null}
      {sinks.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-fg-muted">
            <ArrowUpFromLine className="size-3.5 text-fr-amber" />
            <span>Sinks ({sinks.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sinks.map((c) => (
              <ConnectorCard key={c.vertexId} c={c} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
