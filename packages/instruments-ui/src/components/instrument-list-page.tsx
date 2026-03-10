import { Search, Settings } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState, Skeleton } from "@flink-reactor/ui"
import { useInstrumentStore } from "../store"
import { InstrumentCard } from "./instrument-card"

function InstrumentListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function InstrumentListPage({
  LinkComponent,
}: {
  LinkComponent: React.ComponentType<{
    to: string
    params?: Record<string, string>
    className?: string
    children: React.ReactNode
  }>
}) {
  const instruments = useInstrumentStore((s) => s.instruments)
  const loading = useInstrumentStore((s) => s.loading)
  const error = useInstrumentStore((s) => s.error)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search) return instruments
    const q = search.toLowerCase()
    return instruments.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.displayName.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q),
    )
  }, [instruments, search])

  if (loading && instruments.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-base font-semibold text-zinc-100">Instruments</h1>
        <InstrumentListSkeleton />
      </div>
    )
  }

  if (error && instruments.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-base font-semibold text-zinc-100">Instruments</h1>
        <EmptyState
          icon={Settings}
          message={`Failed to load instruments: ${error}`}
        />
      </div>
    )
  }

  if (instruments.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-base font-semibold text-zinc-100">Instruments</h1>
        <EmptyState icon={Settings} message="No instruments configured" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-zinc-100">Instruments</h1>
        <div className="flex items-center gap-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1">
          <Search className="size-3.5 shrink-0 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter instruments..."
            className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((instrument) => (
          <InstrumentCard
            key={instrument.name}
            instrument={instrument}
            LinkComponent={LinkComponent}
          />
        ))}
      </div>

      {filtered.length === 0 && search && (
        <EmptyState
          icon={Search}
          message={`No instruments match "${search}"`}
        />
      )}
    </div>
  )
}
