import type { InstrumentInfo } from "@/lib/instruments/types"
import { InstrumentHealthBadge } from "./instrument-health-badge"
import { getInstrumentIcon } from "./instrument-icons"

export function InstrumentCard({
  instrument,
  LinkComponent,
}: {
  instrument: InstrumentInfo
  LinkComponent: React.ComponentType<{
    to: string
    params?: Record<string, string>
    className?: string
    children: React.ReactNode
  }>
}) {
  const Icon = getInstrumentIcon(instrument.type)

  return (
    <LinkComponent
      to="/instruments/$instrumentName"
      params={{ instrumentName: instrument.name }}
      className="glass-card flex flex-col gap-3 p-4 transition-colors hover:border-fr-coral/25"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/[0.06]">
            <Icon className="size-4 text-zinc-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-100">
              {instrument.displayName}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {instrument.type} · v{instrument.version}
            </div>
          </div>
        </div>
        <InstrumentHealthBadge
          healthy={instrument.healthy}
          lastHealthCheck={instrument.lastHealthCheck}
        />
      </div>

      {instrument.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {instrument.capabilities.map((cap) => (
            <span
              key={cap}
              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400"
            >
              {cap}
            </span>
          ))}
        </div>
      )}
    </LinkComponent>
  )
}
