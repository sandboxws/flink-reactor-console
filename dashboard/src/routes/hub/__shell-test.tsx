/**
 * Hub Shell Sandbox — exercises the wired-up HubAppShell with empty content.
 *
 * Differs from /hub/sandbox (kitchen-sink primitives) in that this page is
 * about the *chrome*: live cluster selector, real cluster list from
 * useConfigStore, command palette via Cmd+K, breadcrumb component preview.
 *
 * URL: /hub/__shell-test (not in any sidebar).
 */

import { HubBreadcrumb, KpiCard, LiveDot } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Keyboard } from "lucide-react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubShellTest() {
  const rail = (
    <>
      <h3 className="section-heading mb-3">Live</h3>
      <KpiCard
        label="Throughput"
        liveDot="sage"
        value="4.21M"
        sub="evt/s · 5s ago"
      />
      <KpiCard
        label="Slot utilization"
        value="699/768"
        sub="91% · 12 nodes"
        className="mt-3"
      />

      <h3 className="section-heading mb-3 mt-6">Shell features</h3>
      <ul className="space-y-2 text-[12px]">
        <li className="flex items-start gap-2">
          <LiveDot tone="sage" />
          <span className="text-fg-muted">
            Cluster selector reads from{" "}
            <code className="font-mono text-fg">useConfigStore</code>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <LiveDot tone="teal" />
          <span className="text-fg-muted">
            <kbd className="rounded border border-dash-border bg-dash-surface px-1 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>{" "}
            opens the command palette
          </span>
        </li>
        <li className="flex items-start gap-2">
          <LiveDot tone="amber" />
          <span className="text-fg-muted">
            Selected cluster persists to{" "}
            <code className="font-mono text-fg">localStorage</code>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <LiveDot tone="rose" />
          <span className="text-fg-muted">
            Sidebar nav uses TanStack Router (no full reload)
          </span>
        </li>
      </ul>
    </>
  )

  return (
    <HubAppShell rail={rail}>
      <HubBreadcrumb
        crumbs={[
          { label: "Hub", to: "/hub" },
          { label: "Tools", to: "/hub/sandbox" },
          { label: "Shell sandbox" },
        ]}
        LinkComponent={HubLink}
      />
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-sans text-[26px] font-semibold tracking-tight text-zinc-100">
              Shell sandbox
            </h1>
            <span className="rounded border border-fr-coral/40 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-widest text-fr-coral">
              P1 wiring
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-fg-muted">
            Empty-content page that exercises the wired Hub shell — cluster
            selector, command palette, breadcrumb, sidebar nav.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const event = new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              bubbles: true,
            })
            document.dispatchEvent(event)
          }}
        >
          <Keyboard className="size-3.5" />
          Open command palette
        </button>
      </div>

      <section className="mt-10">
        <h2 className="section-heading mb-3">What's wired in P1</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ShellFeatureCard
            title="Cluster selector"
            body="Reads cluster names from useConfigStore.config.clusters; persists selection to localStorage; env tint inferred from name."
          />
          <ShellFeatureCard
            title="Command palette"
            body="Cmd+K (or Ctrl+K) opens the rethemed cmdk dialog. Routes are grouped by section, with G-prefix hotkey hints. Navigates via TanStack Router."
          />
          <ShellFeatureCard
            title="Breadcrumb"
            body="HubBreadcrumb primitive — pure markup, takes a crumbs[] with optional `to` and `mono` flags. Lives in page header above the title row."
          />
          <ShellFeatureCard
            title="HubLink adapter"
            body="Sidebar items + brand glyph route through TanStack Router, preserving Zustand store state across navigation."
          />
          <ShellFeatureCard
            title="Forced dark"
            body="Hub mounts force document dark mode; respects no user palette preference until light/Tokyo Night follow-up changes ship."
          />
          <ShellFeatureCard
            title="Right rail"
            body="Optional via the rail prop. When present, the layout grid switches to with-rail (240/1fr/300). When omitted, main column gets the full width."
          />
        </div>
      </section>
    </HubAppShell>
  )
}

function ShellFeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-card-static p-4">
      <h3 className="text-[13px] font-medium text-zinc-100">{title}</h3>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-muted">
        {body}
      </p>
    </div>
  )
}

export const Route = createFileRoute("/hub/__shell-test")({
  component: HubShellTest,
})
