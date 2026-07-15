import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect } from "react"
import { InstrumentListPage } from "@/components/instruments/instrument-list-page"
import { useInstrumentStore } from "@/stores/instruments-store"

/** Route: /instruments — Instruments list. */
export const Route = createFileRoute("/instruments/")({
  component: () => {
    const fetchInstruments = useInstrumentStore((s) => s.fetchInstruments)
    useEffect(() => {
      fetchInstruments()
    }, [fetchInstruments])
    return <InstrumentListPage LinkComponent={Link} />
  },
})
