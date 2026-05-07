/**
 * Hub instruments landing — /hub/instruments.
 *
 * Grid of `<InstrumentCard>`s, one per instrument registered in the Go
 * backend. Click a card to drill into the instrument-specific browser
 * (Fluss, Redis, Schema Registry, Database).
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { AlertTriangle, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { InstrumentCard } from "@/components/hub/instruments/instrument-card"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { fetchInstruments, type InstrumentInfo } from "@/lib/instruments-data"

function HubInstruments() {
  const [instruments, setInstruments] = useState<InstrumentInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchInstruments()
      .then((list) => {
        if (!cancelled) {
          setInstruments(list)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load instruments",
          )
          setInstruments([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Instruments" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          Instruments
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Pluggable infrastructure connectors registered in the cluster
          configuration. Each card links to an instrument-specific browser.
        </p>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 text-[12px]">
          <AlertTriangle className="mt-0.5 size-3.5 text-fr-rose" />
          <span className="font-mono text-fg">{error}</span>
        </div>
      ) : null}

      {instruments === null ? (
        <p className="text-[12px] font-mono text-fg-faint">
          Loading instruments…
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instruments.map((i) => (
            <InstrumentCard key={i.name} instrument={i} />
          ))}
          <div className="add-card">
            <Plus className="size-4" />
            Add instrument
          </div>
        </div>
      )}
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/instruments/")({
  component: HubInstruments,
})
