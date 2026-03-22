import { useNavigate } from "@tanstack/react-router"
import { Command } from "cmdk"
import {
  AlertTriangle,
  CheckCircle2,
  LayoutDashboard,
  Play,
  ScrollText,
  Server,
  Settings,
  Upload,
} from "lucide-react"
import { useUiStore } from "@/stores/ui-store"

const ROUTES = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Running Jobs", href: "/jobs/running", icon: Play },
  { label: "Completed Jobs", href: "/jobs/completed", icon: CheckCircle2 },
  { label: "Task Managers", href: "/task-managers", icon: Server },
  { label: "Job Manager", href: "/job-manager", icon: Settings },
  { label: "Logs", href: "/logs", icon: ScrollText },
  { label: "Errors", href: "/errors", icon: AlertTriangle },
  { label: "Submit New Job", href: "/jobs/submit", icon: Upload },
]

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen)
  const setOpen = useUiStore((s) => s.toggleCommandPalette)
  const navigate = useNavigate()

  if (!open) return null

  function go(href: string) {
    navigate({ to: href })
    setOpen()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" role="dialog" aria-label="Command palette">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={setOpen}
        onKeyDown={(e) => e.key === "Escape" && setOpen()}
        tabIndex={-1}
      />

      {/* Palette */}
      <Command className="relative w-full max-w-md rounded-lg border border-dash-border bg-dash-panel shadow-2xl">
        <Command.Input
          placeholder="Navigate to..."
          className="w-full border-b border-dash-border bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          autoFocus
        />
        <Command.List className="max-h-64 overflow-y-auto p-1.5">
          <Command.Empty className="px-4 py-3 text-xs text-zinc-500">
            No results found.
          </Command.Empty>
          {ROUTES.map((route) => (
            <Command.Item
              key={route.href}
              value={route.label}
              onSelect={() => go(route.href)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-300 transition-colors data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white"
            >
              <route.icon className="size-4 text-zinc-500" />
              {route.label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}
