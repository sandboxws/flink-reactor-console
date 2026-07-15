import { cn } from "@flink-reactor/ui"
import type { InstrumentInfo } from "@/lib/instruments/types"
import { InstrumentHealthBadge } from "./instrument-health-badge"
import { getInstrumentIcon } from "./instrument-icons"

export function InstrumentShell({
  instrument,
  tabs,
  activePath,
  children,
  LinkComponent,
}: {
  instrument: InstrumentInfo
  tabs: { label: string; path: string }[]
  activePath: string
  children: React.ReactNode
  LinkComponent: React.ComponentType<{
    to: string
    className?: string
    children: React.ReactNode
  }>
}) {
  const Icon = getInstrumentIcon(instrument.type)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="glass-card flex items-center gap-4 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-white/[0.06]">
          <Icon className="size-5 text-zinc-300" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-zinc-100">
            {instrument.displayName}
          </h1>
          <div className="text-xs text-zinc-500">
            {instrument.type} · v{instrument.version}
          </div>
        </div>
        <div className="ml-auto">
          <InstrumentHealthBadge
            healthy={instrument.healthy}
            lastHealthCheck={instrument.lastHealthCheck}
          />
        </div>
      </div>

      {/* Tab navigation */}
      {tabs.length > 0 &&
        (() => {
          // Find the most specific (longest) matching tab path
          const normalized = activePath.replace(/\/$/, "")
          const activeTabPath =
            tabs
              .filter((t) => {
                const tp = t.path.replace(/\/$/, "")
                return normalized === tp || normalized.startsWith(`${tp}/`)
              })
              .sort((a, b) => b.path.length - a.path.length)[0]?.path ?? null

          return (
            <div className="flex gap-1 border-b border-dash-border pb-px">
              {tabs.map((tab) => {
                const active = tab.path === activeTabPath
                return (
                  <LinkComponent
                    key={tab.path}
                    to={tab.path}
                    className={cn(
                      "rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-b-2 border-fr-coral text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {tab.label}
                  </LinkComponent>
                )
              })}
            </div>
          )
        })()}

      {/* Content */}
      {children}
    </div>
  )
}
