"use client"

import {
  Database,
  FileText,
  HardDrive,
  Layers,
  type LucideIcon,
  MessageSquare,
} from "lucide-react"
import type { ConnectorType, JobConnector } from "../../types"
import { cn } from "../../lib/cn"

const connectorIcons: Record<ConnectorType, LucideIcon> = {
  kafka: MessageSquare,
  iceberg: Layers,
  paimon: HardDrive,
  jdbc: Database,
  filesystem: FileText,
  unknown: Database,
}

const connectorLabels: Record<ConnectorType, string> = {
  kafka: "Kafka",
  iceberg: "Iceberg",
  paimon: "Paimon",
  jdbc: "JDBC",
  filesystem: "FileSystem",
  unknown: "Unknown",
}

const connectorColors: Record<ConnectorType, string> = {
  kafka: "text-fr-coral",
  iceberg: "text-blue-400",
  paimon: "text-emerald-400",
  jdbc: "text-fr-purple",
  filesystem: "text-fr-amber",
  unknown: "text-zinc-400",
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function SourceSinkCard({ connector }: { connector: JobConnector }) {
  const Icon = connectorIcons[connector.connectorType] ?? Database
  const label =
    connectorLabels[connector.connectorType] ?? connector.connectorType
  const color = connectorColors[connector.connectorType] ?? "text-zinc-400"

  const isSource = connector.role === "source"

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-md bg-dash-panel",
              color,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">{label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase",
                  isSource
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-blue-500/10 text-blue-400",
                )}
              >
                {connector.role}
              </span>
            </div>
            {connector.resource && (
              <p className="mt-0.5 text-xs text-zinc-400 font-mono">
                {connector.resource}
              </p>
            )}
          </div>
        </div>

        {connector.confidence < 1.0 && (
          <span className="rounded-full bg-fr-amber/10 px-1.5 py-0.5 text-[10px] text-fr-amber">
            {Math.round(connector.confidence * 100)}% confidence
          </span>
        )}
      </div>

      {connector.metrics && (
        <div className="grid grid-cols-2 gap-2 border-t border-dash-border pt-3">
          <div>
            <p className="text-[10px] uppercase text-zinc-500">
              {isSource ? "Records Read" : "Records Written"}
            </p>
            <p className="text-sm font-medium text-zinc-300">
              {formatCount(
                isSource
                  ? connector.metrics.recordsRead
                  : connector.metrics.recordsWritten,
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-500">
              {isSource ? "Bytes Read" : "Bytes Written"}
            </p>
            <p className="text-sm font-medium text-zinc-300">
              {formatBytes(
                isSource
                  ? connector.metrics.bytesRead
                  : connector.metrics.bytesWritten,
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
