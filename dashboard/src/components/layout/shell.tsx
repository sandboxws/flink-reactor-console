import { useInstrumentStore } from "@flink-reactor/instruments-ui"
import { useEffect } from "react"
import { useConfigStore } from "@/stores/config-store"
import { useUiStore } from "@/stores/ui-store"
import { CommandPalette } from "./command-palette"
import { Header } from "./header"
import { Sidebar } from "./sidebar"

export function Shell({ children }: { children: React.ReactNode }) {
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette)
  const fetchConfig = useConfigStore((s) => s.fetchConfig)
  const configLoading = useConfigStore((s) => s.loading)
  const configError = useConfigStore((s) => s.error)
  const fetchInstruments = useInstrumentStore((s) => s.fetchInstruments)

  // Fetch runtime config and instruments on mount
  useEffect(() => {
    fetchConfig()
    fetchInstruments()
  }, [fetchConfig, fetchInstruments])

  // cmd+k / ctrl+k keyboard listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleCommandPalette])

  if (configLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
      </div>
    )
  }

  if (configError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-sm text-red-400">
          Failed to load dashboard configuration: {configError}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  )
}
