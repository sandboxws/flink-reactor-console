import { useEffect } from "react"
import { useInstrumentStore } from "../store"
import { InstrumentListPage } from "../components/instrument-list-page"

export function InstrumentsIndexRoute({
  LinkComponent,
}: {
  LinkComponent: React.ComponentType<{
    to: string
    params?: Record<string, string>
    className?: string
    children: React.ReactNode
  }>
}) {
  const fetchInstruments = useInstrumentStore((s) => s.fetchInstruments)
  useEffect(() => {
    fetchInstruments()
  }, [fetchInstruments])
  return <InstrumentListPage LinkComponent={LinkComponent} />
}
