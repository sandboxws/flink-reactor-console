/** Dashboard-level Hub shell wrapper.
 *
 *  Composes `<HubShell>` from `@flink-reactor/ui` with:
 *  - Cluster selector wrapped in a Popover dropdown sourced from `useConfigStore`
 *  - Command palette (Cmd+K / Ctrl+K) wired to TanStack Router
 *  - The TanStack Router `<HubLink>` adapter for sidebar navigation
 *  - Forced dark mode for the duration the Hub is mounted
 *
 *  Each Hub route renders this once, passing its own children + optional rail. */

import {
  ClusterSelector,
  HubCommandPalette,
  HubShell,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@flink-reactor/ui"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Check } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useConfigStore } from "@/stores/config-store"
import { clusterEnv, useHubStore } from "@/stores/hub-store"
import { HUB_COMMAND_ROUTES } from "./hub-command-routes"
import { HubLink } from "./hub-link"
import { HUB_SIDEBAR_SECTIONS } from "./hub-sidebar-sections"

interface HubAppShellProps {
  /** Page content. */
  children: React.ReactNode
  /** Optional right rail. Omit for full-bleed pages. */
  rail?: React.ReactNode
  /** Apply .dot-grid texture (used on overview-style landing pages). */
  dotGrid?: boolean
}

export function HubAppShell({ children, rail, dotGrid }: HubAppShellProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const config = useConfigStore((s) => s.config)
  const fetchConfig = useConfigStore((s) => s.fetchConfig)
  const selectedCluster = useHubStore((s) => s.selectedCluster)
  const setSelectedCluster = useHubStore((s) => s.setSelectedCluster)
  const commandPaletteOpen = useHubStore((s) => s.commandPaletteOpen)
  const openCommandPalette = useHubStore((s) => s.openCommandPalette)
  const closeCommandPalette = useHubStore((s) => s.closeCommandPalette)
  const toggleCommandPalette = useHubStore((s) => s.toggleCommandPalette)

  /* Force dark mode and ensure config is loaded. */
  useEffect(() => {
    document.documentElement.classList.add("dark")
    document.documentElement.removeAttribute("data-palette")
    fetchConfig()
  }, [fetchConfig])

  /* Cmd+K / Ctrl+K toggles the command palette; "/" opens it (Linear-style)
   *  unless an input/textarea is focused. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        toggleCommandPalette()
        return
      }
      if (e.key === "/" && !isEditable) {
        e.preventDefault()
        openCommandPalette()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
    }
  }, [toggleCommandPalette, openCommandPalette])

  /* Resolve active cluster: persisted selection > first config cluster > placeholder. */
  const clusters = config?.clusters ?? []
  const activeClusterName =
    selectedCluster && clusters.includes(selectedCluster)
      ? selectedCluster
      : (clusters[0] ?? config?.clusterDisplayName ?? "no cluster")
  const activeEnv = useMemo(
    () => clusterEnv(activeClusterName),
    [activeClusterName],
  )

  return (
    <>
      <HubShell
        sidebarSections={HUB_SIDEBAR_SECTIONS}
        activePath={pathname}
        LinkComponent={HubLink}
        dotGrid={dotGrid}
        rail={rail}
        topBar={{
          clusterSlot: (
            <ClusterDropdown
              clusters={clusters}
              active={activeClusterName}
              activeEnv={activeEnv}
              onSelect={setSelectedCluster}
            />
          ),
          onSearchOpen: openCommandPalette,
        }}
      >
        {children}
      </HubShell>

      <HubCommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        onNavigate={(href) => navigate({ to: href })}
        routes={HUB_COMMAND_ROUTES}
      />
    </>
  )
}

/** Cluster pill + dropdown menu. Shown only when at least one cluster is
 *  configured; otherwise the slot is empty (the wrapper passes a fragment). */
function ClusterDropdown({
  clusters,
  active,
  activeEnv,
  onSelect,
}: {
  clusters: string[]
  active: string
  activeEnv: "prod" | "stage" | "dev"
  onSelect: (name: string) => void
}) {
  if (clusters.length <= 1) {
    return <ClusterSelector env={activeEnv} cluster={active} />
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ClusterSelector env={activeEnv} cluster={active} />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="z-50 min-w-[240px] border-dash-border bg-dash-panel p-1.5"
      >
        <div className="mb-1.5 px-2 pt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          Switch cluster
        </div>
        {clusters.map((name) => {
          const env = clusterEnv(name)
          const isActive = name === active
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-fg-muted transition-colors hover:bg-fr-coral/10 hover:text-zinc-100"
            >
              <span className={`env ${env} font-mono`}>{env}</span>
              <span className="flex-1 truncate font-mono">{name}</span>
              {isActive ? (
                <Check className="size-3.5 text-fr-sage" aria-hidden="true" />
              ) : null}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
