import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { InstrumentListPage } from "@/components/instruments/instrument-list-page"
import { useInstrumentStore } from "@/stores/instrument-store"

export const Route = createFileRoute("/instruments/")({
  component: InstrumentsRoute,
})

function InstrumentsRoute() {
  const fetchInstruments = useInstrumentStore((s) => s.fetchInstruments)

  useEffect(() => {
    fetchInstruments()
  }, [fetchInstruments])

  return <InstrumentListPage />
}
