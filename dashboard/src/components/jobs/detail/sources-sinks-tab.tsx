/**
 * @module sources-sinks-tab
 *
 * Overview tab listing all detected sources and sinks for a Flink job.
 * Splits connectors by role into separate sections and renders each as a
 * {@link SourceSinkCard}. Shows a prompt to use FlinkReactor DSL when no
 * connectors are detected.
 */

import { ArrowDown, ArrowUp, Unplug } from "lucide-react"
import type { JobConnector } from "@flink-reactor/ui"
import { SourceSinkCard } from "./source-sink-card"

/**
 * Sources and sinks overview tab partitioning connectors into "Sources" and "Sinks"
 * sections rendered as a grid of {@link SourceSinkCard} components.
 */
export function SourcesSinksTab({
  sourcesAndSinks,
}: {
  sourcesAndSinks: JobConnector[]
}) {
  if (sourcesAndSinks.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-2 py-16">
        <Unplug className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">
          No sources or sinks detected for this job
        </p>
        <p className="text-xs text-zinc-600">
          Deploy with FlinkReactor DSL for structured connector detection
        </p>
      </div>
    )
  }

  const sources = sourcesAndSinks.filter((c) => c.role === "source")
  const sinks = sourcesAndSinks.filter((c) => c.role === "sink")

  return (
    <div className="flex flex-col gap-6">
      {sources.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ArrowDown className="size-3.5 text-status-active" />
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Sources ({sources.length})
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((c) => (
              <SourceSinkCard key={c.vertexId} connector={c} />
            ))}
          </div>
        </section>
      )}

      {sinks.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ArrowUp className="size-3.5 text-blue-400" />
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Sinks ({sinks.length})
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sinks.map((c) => (
              <SourceSinkCard key={c.vertexId} connector={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
