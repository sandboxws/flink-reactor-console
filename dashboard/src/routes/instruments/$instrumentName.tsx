import { createFileRoute, Outlet } from "@tanstack/react-router"
import { AlertCircle, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { InstrumentShell } from "@/components/instruments/instrument-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useInstrumentStore } from "@/stores/instrument-store"

export const Route = createFileRoute("/instruments/$instrumentName")({
  component: InstrumentDetailRoute,
})

function InstrumentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="glass-card flex items-center gap-4 p-4">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}

function InstrumentDetailRoute() {
  const { instrumentName } = Route.useParams()
  const fetchInstruments = useInstrumentStore((s) => s.fetchInstruments)
  const getInstrument = useInstrumentStore((s) => s.getInstrument)
  const loading = useInstrumentStore((s) => s.loading)
  const instruments = useInstrumentStore((s) => s.instruments)

  useEffect(() => {
    fetchInstruments()
  }, [fetchInstruments])

  const instrument = getInstrument(instrumentName)

  if (loading && instruments.length === 0) {
    return <InstrumentDetailSkeleton />
  }

  if (!instrument) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="flex max-w-lg flex-col items-center gap-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-job-failed/10">
            <AlertCircle className="h-6 w-6 text-job-failed" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium text-zinc-300">
              Instrument not found
            </h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              No instrument named "{instrumentName}" is configured.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInstruments()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Tabs will be populated by per-instrument type changes (e.g., kafka → topics, consumer groups)
  const tabs: { label: string; path: string }[] = []

  return (
    <InstrumentShell instrument={instrument} tabs={tabs}>
      <Outlet />
    </InstrumentShell>
  )
}
