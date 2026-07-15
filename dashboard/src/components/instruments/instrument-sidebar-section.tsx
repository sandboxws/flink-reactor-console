import { cn } from "@flink-reactor/ui"
import { useInstrumentStore } from "@/stores/instruments-store"
import { getInstrumentIcon } from "./instrument-icons"

export function InstrumentSidebarSection({
  collapsed,
  activePath,
  LinkComponent,
}: {
  collapsed: boolean
  activePath: string
  LinkComponent: React.ComponentType<{
    to: string
    className?: string
    children: React.ReactNode
  }>
}) {
  const instruments = useInstrumentStore((s) => s.instruments)
  const loading = useInstrumentStore((s) => s.loading)

  if (loading && instruments.length === 0) {
    return (
      <div className="mb-1">
        {!collapsed && (
          <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Instruments
          </div>
        )}
        <div className="space-y-0.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
            >
              <div className="size-3.5 shrink-0 animate-pulse rounded bg-zinc-700" />
              {!collapsed && (
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-700" />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (instruments.length === 0) return null

  return (
    <div className="mb-1">
      {!collapsed && (
        <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Instruments
        </div>
      )}
      <div className="space-y-0.5">
        {instruments.map((inst) => {
          const Icon = getInstrumentIcon(inst.type)
          const href = `/instruments/${inst.name}`
          const active = activePath.startsWith(href)
          return (
            <LinkComponent
              key={inst.name}
              to={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {!collapsed && <span>{inst.displayName}</span>}
            </LinkComponent>
          )
        })}
      </div>
    </div>
  )
}
