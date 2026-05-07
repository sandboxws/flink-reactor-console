/**
 * Hub Foundation Sandbox — kitchen-sink page rendering every primitive
 * with all variants. Reachable only at /hub/primitive-sandbox; not in
 * any sidebar.
 *
 * Renamed from /hub/sandbox in P4 (`fr-console-hub-tools-instruments`) to
 * free up `/hub/sandbox/*` for the user-facing DSL editor at
 * `/hub/sandbox/editor`. A transient redirect from `/hub/sandbox` lives at
 * `routes/hub/sandbox/index.tsx` for one release; remove at cutover.
 */

import {
  ClusterSelector,
  DiffLine,
  DiffViewer,
  HeatmapCalendar,
  HeatmapCell,
  type HeatmapIntensity,
  KpiCard,
  LiveDot,
  PriorityBars,
  PropChip,
  SevBadge,
  StatePill,
  StatusIcon,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import {
  BellRing,
  CircleCheck,
  Code2,
  Filter,
  LineChart,
  MoreHorizontal,
  Plus,
  Search,
  SearchCode,
  Tag,
  Upload,
  Users,
} from "lucide-react"
import { useMemo } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="section-heading mb-1">{title}</h2>
      {description ? (
        <p className="text-[12px] text-fg-muted mb-4">{description}</p>
      ) : null}
      {children}
    </section>
  )
}

function ColorSwatch({
  name,
  value,
  varName,
}: {
  name: string
  value: string
  varName: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dash-border p-3">
      <div
        className="size-10 rounded shrink-0"
        style={{ background: `var(${varName})` }}
      />
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-fg">{name}</div>
        <div className="font-mono text-[10px] text-fg-dim truncate">
          {varName}
        </div>
        <div className="font-mono text-[10px] text-fg-faint truncate">
          {value}
        </div>
      </div>
    </div>
  )
}

const SAMPLE_BEFORE = `cluster:
  flink_version: "1.20.0"
  parallelism: 12
  taskmanagers: 6
checkpointing:
  interval: 60s
  timeout: 600s`

const SAMPLE_AFTER = `cluster:
  flink_version: "1.20.1"
  parallelism: 24
  taskmanagers: 12
  region: "us-west-2"
checkpointing:
  interval: 30s
  timeout: 600s`

function HubSandbox() {
  const heatmapData = useMemo<HeatmapIntensity[]>(() => {
    /* Deterministic pseudo-random — keeps sandbox stable across reloads. */
    const seeded = (n: number) => {
      const x = Math.sin(n) * 10000
      return x - Math.floor(x)
    }
    return Array.from({ length: 26 * 7 }, (_, i) => {
      const r = seeded(i + 1)
      if (r < 0.3) return 0
      if (r < 0.55) return 1
      if (r < 0.78) return 2
      if (r < 0.93) return 3
      return 4
    }) as HeatmapIntensity[]
  }, [])

  /* Right rail content — mirrors console-v2/overview.html exactly:
     LIVE KPIs, Cluster info, Quick actions. */
  const sandboxRail = (
    <>
      <h3 className="section-heading mb-3">Live</h3>
      <div className="space-y-3">
        <KpiCard
          label="Throughput"
          liveDot="sage"
          value={
            <span className="flex items-baseline gap-1">
              <span>4.21M</span>
              <span className="text-[10px] font-normal text-fg-muted">
                evt/s
              </span>
            </span>
          }
          sub="↑ 8.4% vs 1h ago"
        />
        <KpiCard
          label="Slot utilization"
          value={
            <span className="font-mono text-[18px] text-fg">
              699<span className="text-fg-faint">/768</span>
            </span>
          }
          sub="91% · 12 nodes"
        >
          <div className="resource-bar mt-2">
            <div className="seg heap" style={{ width: "91%" }} />
            <div className="seg free" style={{ width: "9%" }} />
          </div>
        </KpiCard>
        <KpiCard
          label="Checkpoints / min"
          value="1,247"
          sub="avg duration 84ms"
        />
      </div>

      <h3 className="section-heading mb-3 mt-6">Cluster</h3>
      <div className="space-y-2 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">Flink version</span>
          <span className="font-mono text-fg">1.20.1</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">Reactor</span>
          <span className="font-mono text-fg">v0.9.4</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">Region</span>
          <span className="font-mono text-fg">us-west-2</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">Uptime</span>
          <span className="font-mono text-fg">28d 14h</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">JM leader</span>
          <span className="font-mono text-fg">jm-01</span>
        </div>
      </div>

      <h3 className="section-heading mb-3 mt-6">Quick actions</h3>
      <div className="space-y-1.5">
        <a href="/hub/jobs/submit" className="nav-item w-full">
          <Upload className="size-3.5 shrink-0" />
          Submit JAR
        </a>
        <a href="/hub/sandbox" className="nav-item w-full">
          <Code2 className="size-3.5 shrink-0" />
          Open sandbox
        </a>
        <a href="/hub/sql-explorer" className="nav-item w-full">
          <SearchCode className="size-3.5 shrink-0" />
          SQL explorer
        </a>
        <a href="/hub/insights/metrics" className="nav-item w-full">
          <LineChart className="size-3.5 shrink-0" />
          Build metric
        </a>
      </div>
    </>
  )

  return (
    <HubAppShell dotGrid rail={sandboxRail}>
      <header className="mb-10">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight text-zinc-100">
            Hub Foundation Sandbox
          </h1>
          <span className="rounded border border-fr-coral/40 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-widest text-fr-coral">
            Alpha
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] text-fg-muted">
          Every primitive from the FlinkReactor Hub design system, with all
          variants. This page is dev/designer-facing and not linked from any
          sidebar. URL:{" "}
          <code className="font-mono text-fr-coral">/hub/sandbox</code>.
        </p>
      </header>

      {/* ── Tokens ─────────────────────────────────────────────────── */}
      <Section
        title="Brand & semantic tokens"
        description="Hub adds sage, teal, rose, violet to the existing coral, amber, purple. fr-purple is a deprecated alias for fr-sage."
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
          <ColorSwatch
            name="Coral"
            varName="--color-fr-coral"
            value="#e78a4e"
          />
          <ColorSwatch name="Sage" varName="--color-fr-sage" value="#a9b665" />
          <ColorSwatch
            name="Amber"
            varName="--color-fr-amber"
            value="#d8a657"
          />
          <ColorSwatch name="Teal" varName="--color-fr-teal" value="#7daea3" />
          <ColorSwatch name="Rose" varName="--color-fr-rose" value="#ea6962" />
          <ColorSwatch
            name="Violet"
            varName="--color-fr-violet"
            value="#bb9af7"
          />
          <ColorSwatch name="Bg" varName="--color-fr-bg" value="#101213" />
          <ColorSwatch
            name="Subtle"
            varName="--color-fr-subtle"
            value="#141617"
          />
        </div>
      </Section>

      {/* ── KpiCard ────────────────────────────────────────────────── */}
      <Section
        title="KpiCard"
        description="Mono-styled metric card. Used in overview hero, right rails, job KPI strips. The label can host a live-dot."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Throughput"
            liveDot="sage"
            value={
              <span className="flex items-baseline gap-1">
                <span>4.21M</span>
                <span className="text-[12px] font-normal text-fg-muted">
                  evt/s
                </span>
              </span>
            }
            sub="live across 7 pipelines · 5s ago"
          />
          <KpiCard
            label="Watermark lag"
            value="12ms"
            sub="p99 over last 5 min"
          />
          <KpiCard
            label="Active reactors"
            value="847"
            sub="12 nodes · 91% util"
          />
          <KpiCard
            label="SLO"
            value={
              <span className="text-fr-sage">
                99.99
                <span className="text-[14px] text-fg-muted">%</span>
              </span>
            }
            sub="28-day rolling, target 99.9%"
          />
        </div>
      </Section>

      {/* ── LiveDot ────────────────────────────────────────────────── */}
      <Section
        title="LiveDot"
        description="7px pulsing dot for running indicators. Five tones with matching glow."
      >
        <div className="glass-card-static flex items-center gap-6 p-4">
          {(["sage", "coral", "amber", "rose", "teal"] as const).map((tone) => (
            <div key={tone} className="flex items-center gap-2">
              <LiveDot tone={tone} />
              <span className="font-mono text-[11px] text-fg-muted">
                {tone}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── StatusIcon ─────────────────────────────────────────────── */}
      <Section
        title="StatusIcon"
        description="Linear-style 14px alert state indicators with conic-gradient fills. Six states."
      >
        <div className="glass-card-static grid grid-cols-3 gap-4 p-4 md:grid-cols-6">
          {(
            [
              "firing",
              "acknowledged",
              "in-progress",
              "resolved",
              "suppressed",
              "silenced",
            ] as const
          ).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <StatusIcon state={s} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                {s}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PriorityBars ───────────────────────────────────────────── */}
      <Section
        title="PriorityBars"
        description="Linear-style 3-bar priority indicator. Five levels."
      >
        <div className="glass-card-static flex items-center gap-6 p-4">
          {(["none", "low", "medium", "high", "urgent"] as const).map(
            (level) => (
              <div key={level} className="flex items-center gap-2">
                <PriorityBars level={level} />
                <span className="font-mono text-[11px] text-fg-muted">
                  {level}
                </span>
              </div>
            ),
          )}
        </div>
      </Section>

      {/* ── SevBadge ───────────────────────────────────────────────── */}
      <Section
        title="SevBadge"
        description="Monospace severity pill. Distinct from the rounded <Badge> primitive."
      >
        <div className="glass-card-static flex flex-wrap items-center gap-3 p-4">
          <SevBadge tone="ok">OK</SevBadge>
          <SevBadge tone="warn">WARN</SevBadge>
          <SevBadge tone="fail">FAIL</SevBadge>
          <SevBadge tone="info">INFO</SevBadge>
          <SevBadge tone="muted">MUTED</SevBadge>
          <SevBadge tone="coral">CORAL</SevBadge>
        </div>
      </Section>

      {/* ── StatePill ──────────────────────────────────────────────── */}
      <Section
        title="StatePill"
        description="Deployment state-machine pill. Used on deployment timelines."
      >
        <div className="glass-card-static flex items-center gap-3 p-4">
          <StatePill state="done">Done</StatePill>
          <StatePill state="active">Active</StatePill>
          <StatePill state="pending">Pending</StatePill>
          <StatePill state="failed">Failed</StatePill>
        </div>
      </Section>

      {/* ── PropChip ───────────────────────────────────────────────── */}
      <Section
        title="PropChip"
        description="Filter / property chip. Toggleable via `active`. Optional count and icon."
      >
        <div className="glass-card-static flex flex-wrap items-center gap-3 p-4">
          <PropChip>Plain</PropChip>
          <PropChip active>Active</PropChip>
          <PropChip count={12}>With count</PropChip>
          <PropChip icon={Filter}>Icon</PropChip>
          <PropChip icon={Search} active count={3}>
            All
          </PropChip>
          <PropChip icon={BellRing}>Alerts</PropChip>
          <PropChip icon={Tag}>Tagged</PropChip>
          <PropChip icon={Users}>Owners</PropChip>
        </div>
      </Section>

      {/* ── ClusterSelector ────────────────────────────────────────── */}
      <Section
        title="ClusterSelector"
        description="Top-bar cluster picker pill. Env tints prod=rose / stage=amber / dev=teal."
      >
        <div className="glass-card-static flex flex-wrap items-center gap-3 p-4">
          <ClusterSelector env="prod" cluster="acme-prod-1.fr" />
          <ClusterSelector env="stage" cluster="acme-stage-1.fr" />
          <ClusterSelector env="dev" cluster="dev-local" />
        </div>
      </Section>

      {/* ── HeatmapCell + HeatmapCalendar ──────────────────────────── */}
      <Section
        title="HeatmapCell + HeatmapCalendar"
        description="5-level intensity scale. Calendar tiles 26 weeks of daily data."
      >
        <div className="glass-card-static p-5">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-mono text-fg-faint">
            <span>less</span>
            {([0, 1, 2, 3, 4] as const).map((i) => (
              <HeatmapCell key={i} intensity={i} />
            ))}
            <span>more</span>
          </div>
          <HeatmapCalendar data={heatmapData} weeks={26} />
          <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
            <span>26 weeks ago</span>
            <span>~847,000 events · seeded sample</span>
            <span>now</span>
          </div>
        </div>
      </Section>

      {/* ── DiffLine + DiffViewer ──────────────────────────────────── */}
      <Section
        title="DiffLine + DiffViewer"
        description="Background-tint diff. No left-border accents. Sage = added, coral = removed, teal = hunk."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-[12px] font-medium text-fg mb-2">
              <code className="font-mono text-fg-muted">{"<DiffLine>"}</code>{" "}
              variants
            </h3>
            <div className="rounded-md border border-dash-border overflow-hidden">
              <DiffLine variant="hunk" oldLineNo="" newLineNo="">
                @@ -3,5 +3,7 @@
              </DiffLine>
              <DiffLine variant="context" oldLineNo={3} newLineNo={3}>
                {"  parallelism: 12"}
              </DiffLine>
              <DiffLine variant="removed" oldLineNo={4}>
                {"  taskmanagers: 6"}
              </DiffLine>
              <DiffLine variant="added" newLineNo={4}>
                {"  taskmanagers: 12"}
              </DiffLine>
              <DiffLine variant="added" newLineNo={5}>
                {'  region: "us-west-2"'}
              </DiffLine>
              <DiffLine variant="context" oldLineNo={5} newLineNo={6}>
                checkpointing:
              </DiffLine>
            </div>
          </div>
          <div>
            <h3 className="text-[12px] font-medium text-fg mb-2">
              <code className="font-mono text-fg-muted">{"<DiffViewer>"}</code>{" "}
              with LCS
            </h3>
            <DiffViewer a={SAMPLE_BEFORE} b={SAMPLE_AFTER} />
          </div>
        </div>
      </Section>

      {/* ── Glass card variants ────────────────────────────────────── */}
      <Section
        title="Glass card variants"
        description=".glass-card has hover lift; .glass-card-static is for non-interactive containers."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="glass-card p-4">
            <h3 className="text-[13px] font-medium text-zinc-100">
              .glass-card
            </h3>
            <p className="mt-1 text-[11px] text-fg-muted">
              Hover me — coral border + lift.
            </p>
          </div>
          <div className="glass-card-static p-4">
            <h3 className="text-[13px] font-medium text-zinc-100">
              .glass-card-static
            </h3>
            <p className="mt-1 text-[11px] text-fg-muted">
              No hover transform. For dashboards and dense panels.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Faux syntax tinting ────────────────────────────────────── */}
      <Section
        title="Faux syntax tinting (.tk-*)"
        description="Inline tinting for code-viewer, log-viewer, SQL editor, and config blocks."
      >
        <div className="glass-card-static p-4">
          <pre className="font-mono text-[12.5px]">
            <span className="tk-com">{"// Tinting demo\n"}</span>
            <span className="tk-key">function</span>{" "}
            <span className="tk-fn">computeDiff</span>
            <span className="tk-pun">(</span>
            <span className="tk-attr">a</span>
            <span className="tk-pun">: </span>
            <span className="tk-typ">string</span>
            <span className="tk-pun">, </span>
            <span className="tk-attr">b</span>
            <span className="tk-pun">: </span>
            <span className="tk-typ">string</span>
            <span className="tk-pun">)</span>
            <span className="tk-pun"> {"{"}</span>
            {"\n  "}
            <span className="tk-key">return</span>{" "}
            <span className="tk-str">"sage strings, coral nums "</span>
            <span className="tk-op">+</span> <span className="tk-num">42</span>
            <span className="tk-pun">;</span>
            {"\n"}
            <span className="tk-pun">{"}"}</span>
          </pre>
        </div>
      </Section>

      {/* ── Resource bar ───────────────────────────────────────────── */}
      <Section
        title="Resource bar (.resource-bar)"
        description="Stacked segments for memory breakdown. Heap=sage, managed=amber, network=teal, direct=coral."
      >
        <div className="glass-card-static space-y-4 p-4">
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-mono text-fg-dim">
              <span>tm-01 memory</span>
              <span>91% used</span>
            </div>
            <div className="resource-bar">
              <div className="seg heap" style={{ width: "44%" }} />
              <div className="seg managed" style={{ width: "26%" }} />
              <div className="seg network" style={{ width: "12%" }} />
              <div className="seg direct" style={{ width: "9%" }} />
              <div className="seg free" style={{ width: "9%" }} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Sparkbar ───────────────────────────────────────────────── */}
      <Section
        title="Sparkbar (.sparkbar)"
        description="Outcome histogram for simulation runs."
      >
        <div className="glass-card-static p-4">
          <div className="sparkbar">
            <span className="pass" style={{ height: "75%" }} />
            <span className="pass" style={{ height: "85%" }} />
            <span className="pass" style={{ height: "70%" }} />
            <span className="fail" style={{ height: "20%" }} />
            <span className="run" style={{ height: "55%" }} />
            <span className="pass" style={{ height: "90%" }} />
            <span className="info" style={{ height: "45%" }} />
            <span className="skip" style={{ height: "30%" }} />
            <span className="pass" style={{ height: "80%" }} />
            <span className="run" style={{ height: "60%" }} />
            <span className="pass" style={{ height: "95%" }} />
          </div>
        </div>
      </Section>

      {/* ── Health ring ────────────────────────────────────────────── */}
      <Section
        title="Health ring (.health-ring)"
        description="Concentric SVG ring. Pure CSS class; render with your own SVG."
      >
        <div className="glass-card-static flex items-center gap-6 p-4">
          <div className="health-ring">
            <svg viewBox="0 0 80 80">
              <circle
                className="ring-bg"
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="6"
              />
              <circle
                className="ring-fg"
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="6"
                strokeDasharray="213.6 26.4"
                strokeLinecap="round"
              />
            </svg>
            <div className="ring-label">98%</div>
          </div>
          <div>
            <div className="text-[14px] font-medium text-zinc-100">
              Cluster health
            </div>
            <div className="text-[11px] font-mono text-fg-muted">
              4 of 7 pipelines nominal · 3 with warnings
            </div>
          </div>
        </div>
      </Section>

      {/* ── Log viewer ─────────────────────────────────────────────── */}
      <Section
        title="Log viewer (.log-viewer)"
        description="Mono-grid log surface. Pure CSS class — wire up to your row data."
      >
        <div className="log-viewer">
          <div className="log-row">
            <span className="log-num">12</span>
            <span className="log-time">14:23:01.842</span>
            <span className="log-level info">info</span>
            <span className="log-msg info">
              Checkpoint #10238 completed for reactor-core (84ms)
            </span>
          </div>
          <div className="log-row">
            <span className="log-num">13</span>
            <span className="log-time">14:23:14.117</span>
            <span className="log-level warn">warn</span>
            <span className="log-msg warn">
              Backpressure on operator 4 of datalake-connect — busy 624ms/s
            </span>
          </div>
          <div className="log-row">
            <span className="log-num">14</span>
            <span className="log-time">14:23:42.503</span>
            <span className="log-level error">error</span>
            <span className="log-msg error">
              CheckpointDeclineException at o.a.f.runtime.checkpoint:892
            </span>
          </div>
          <div className="log-row">
            <span className="log-num">15</span>
            <span className="log-time">14:23:55.020</span>
            <span className="log-level debug">debug</span>
            <span className="log-msg debug">
              Restarting subtask 18 of 32 after operator timeout
            </span>
          </div>
        </div>
      </Section>

      {/* ── Activity entry + file-tree-row ─────────────────────────── */}
      <Section
        title="Activity entry & file-tree row"
        description="CSS classes used in overview activity feed and the catalog browser tree."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Recent activity</h3>
            <div className="divide-y divide-dash-border/40">
              <div className="activity-entry">
                <span className="activity-icon">
                  <LiveDot />
                </span>
                <span className="activity-text">
                  Checkpoint <strong>#10238</strong> completed for{" "}
                  <strong>reactor-core</strong>
                </span>
                <span className="activity-time">2m ago</span>
              </div>
              <div className="activity-entry">
                <span className="activity-icon">
                  <LiveDot tone="amber" />
                </span>
                <span className="activity-text">
                  Backpressure detected on <strong>datalake-connect</strong>{" "}
                  op.4
                </span>
                <span className="activity-time">22m ago</span>
              </div>
              <div className="activity-entry">
                <span className="activity-icon">
                  <LiveDot tone="rose" />
                </span>
                <span className="activity-text">
                  Job <strong>cdc-loader</strong> failed — restart pending
                </span>
                <span className="activity-time">31m ago</span>
              </div>
            </div>
          </div>
          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Catalog tree</h3>
            <div className="space-y-0">
              <div className="file-tree-row active">▾ default_catalog</div>
              <div className="file-tree-row pl-6">▾ retail</div>
              <div className="file-tree-row pl-12">orders_realtime</div>
              <div className="file-tree-row pl-12">payments</div>
              <div className="file-tree-row pl-6">▸ analytics</div>
              <div className="file-tree-row">▸ paimon_catalog</div>
              <div className="file-tree-row">▸ schema_registry</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Kanban ─────────────────────────────────────────────────── */}
      <Section
        title="Kanban (.kanban-col / .kanban-card)"
        description="Deployment board pattern matching console-v2/deployments.html. Status-icon in column header conveys state — no left-border accents on cards."
      >
        <div className="flex gap-3 overflow-x-auto pb-3">
          {/* PENDING */}
          <div className="kanban-col">
            <div className="kanban-col-header">
              <div className="flex items-center gap-2">
                <StatusIcon state="suppressed" />
                <span className="text-[12px] font-medium text-zinc-100">
                  Pending
                </span>
                <span className="font-mono text-[11px] text-fg-faint">2</span>
              </div>
              <button
                type="button"
                aria-label="More"
                className="text-fg-faint hover:text-fr-coral"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </div>
            <div className="kanban-col-body">
              <button type="button" className="kanban-card text-left">
                <div className="flex items-center justify-between">
                  <span className="card-id">DEP-247</span>
                  <span className="font-mono text-[10px] text-fr-amber">
                    v0.9.5-rc1
                  </span>
                </div>
                <div className="card-title">paimon-sink schema migration</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-fg-faint">
                    +12 / -8 cfg
                  </span>
                  <span className="avatar avatar-teal h-4 w-4 text-[8px]">
                    L
                  </span>
                </div>
              </button>
              <button type="button" className="kanban-card text-left">
                <div className="flex items-center justify-between">
                  <span className="card-id">DEP-246</span>
                  <span className="font-mono text-[10px] text-fg-faint">
                    v0.9.4-hf2
                  </span>
                </div>
                <div className="card-title">cdc-loader retry policy hotfix</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-fg-faint">
                    +3 / -1 cfg
                  </span>
                  <span className="avatar avatar-rose h-4 w-4 text-[8px]">
                    P
                  </span>
                </div>
              </button>
            </div>
            <div className="add-card">
              <Plus className="size-3" />
              Add deployment
            </div>
          </div>

          {/* VALIDATING */}
          <div className="kanban-col">
            <div className="kanban-col-header">
              <div className="flex items-center gap-2">
                <StatusIcon state="acknowledged" />
                <span className="text-[12px] font-medium text-zinc-100">
                  Validating
                </span>
                <span className="font-mono text-[11px] text-fr-amber">1</span>
              </div>
              <button
                type="button"
                aria-label="More"
                className="text-fg-faint hover:text-fr-coral"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </div>
            <div className="kanban-col-body">
              <button type="button" className="kanban-card text-left">
                <div className="flex items-center justify-between">
                  <span className="card-id">DEP-245</span>
                  <span className="font-mono text-[10px] text-fr-coral">
                    v0.9.5
                  </span>
                </div>
                <div className="card-title">
                  fluss-ingest parallelism bump 16→24
                </div>
                <div className="mt-2">
                  <div className="resource-bar" style={{ height: 4 }}>
                    <div className="seg heap" style={{ width: "42%" }} />
                    <div className="seg free" style={{ width: "58%" }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-fr-amber">smoke 42% · est 2m</span>
                    <span className="avatar avatar-sage h-4 w-4 text-[8px]">
                      K
                    </span>
                  </div>
                </div>
              </button>
            </div>
            <div className="add-card">
              <Plus className="size-3" />
              Add deployment
            </div>
          </div>

          {/* ROLLING OUT */}
          <div className="kanban-col">
            <div className="kanban-col-header">
              <div className="flex items-center gap-2">
                <StatusIcon state="in-progress" />
                <span className="text-[12px] font-medium text-zinc-100">
                  Rolling out
                </span>
                <span className="font-mono text-[11px] text-fr-coral">1</span>
              </div>
              <button
                type="button"
                aria-label="More"
                className="text-fg-faint hover:text-fr-coral"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </div>
            <div className="kanban-col-body">
              <button type="button" className="kanban-card text-left">
                <div className="flex items-center justify-between">
                  <span className="card-id">DEP-244</span>
                  <span className="font-mono text-[10px] text-fr-sage">
                    v0.9.5
                  </span>
                </div>
                <div className="card-title">
                  reactor-core SSE backpressure fix
                </div>
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-fg-muted">blue → green</span>
                    <span className="text-fr-sage">68%</span>
                  </div>
                  <div className="resource-bar" style={{ height: 4 }}>
                    <div className="seg heap" style={{ width: "68%" }} />
                    <div className="seg free" style={{ width: "32%" }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-fr-sage">
                      <LiveDot />
                      shifting traffic
                    </span>
                    <span className="avatar avatar-coral h-4 w-4 text-[8px]">
                      A
                    </span>
                  </div>
                </div>
              </button>
            </div>
            <div className="add-card">
              <Plus className="size-3" />
              Add deployment
            </div>
          </div>

          {/* ROLLING BACK */}
          <div className="kanban-col">
            <div className="kanban-col-header">
              <div className="flex items-center gap-2">
                <StatusIcon state="firing" />
                <span className="text-[12px] font-medium text-zinc-100">
                  Rolling back
                </span>
                <span className="font-mono text-[11px] text-fg-faint">0</span>
              </div>
              <button
                type="button"
                aria-label="More"
                className="text-fg-faint hover:text-fr-coral"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </div>
            <div className="kanban-col-body">
              <div className="px-2 py-6 text-center text-[11px] font-mono text-fg-faint">
                <CircleCheck className="mx-auto mb-1 block size-4 text-fr-sage" />
                no active rollbacks
              </div>
            </div>
            <div className="add-card">
              <Plus className="size-3" />
              Add deployment
            </div>
          </div>

          {/* COMPLETE */}
          <div className="kanban-col">
            <div className="kanban-col-header">
              <div className="flex items-center gap-2">
                <StatusIcon state="resolved" />
                <span className="text-[12px] font-medium text-zinc-100">
                  Complete
                </span>
                <span className="font-mono text-[11px] text-fr-sage">5</span>
              </div>
              <button
                type="button"
                aria-label="More"
                className="text-fg-faint hover:text-fr-coral"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </div>
            <div className="kanban-col-body">
              {[
                {
                  id: "DEP-243",
                  v: "v0.9.4",
                  vClass: "text-fr-sage",
                  title: "schema-registry-sync TLS upgrade",
                  meta: "2h ago · 4m",
                  metaClass: "text-fr-sage",
                  initial: "M",
                  avatarClass: "avatar-amber",
                },
                {
                  id: "DEP-242",
                  v: "v0.9.4",
                  vClass: "text-fr-sage",
                  title: "clickstream-enrich window tweak 30s→45s",
                  meta: "8h ago · 12m",
                  metaClass: "text-fr-sage",
                  initial: "O",
                  avatarClass: "avatar-deep",
                },
                {
                  id: "DEP-241",
                  v: "v0.9.4",
                  vClass: "text-fr-sage",
                  title: "datalake-connect retry-on-throttle",
                  meta: "1d ago · 7m",
                  metaClass: "text-fr-sage",
                  initial: "N",
                  avatarClass: "avatar-mixed",
                },
                {
                  id: "DEP-240",
                  v: "v0.9.4",
                  vClass: "text-fr-sage",
                  title: "reactor-core JVM heap 64→96G",
                  meta: "2d ago · 18m",
                  metaClass: "text-fr-sage",
                  initial: "A",
                  avatarClass: "avatar-coral",
                },
                {
                  id: "DEP-239",
                  v: "v0.9.4-rc3",
                  vClass: "text-fg-faint",
                  title: "cdc-loader rocksdb tuning",
                  meta: "3d ago · rolled back",
                  metaClass: "text-fr-rose",
                  initial: "P",
                  avatarClass: "avatar-rose",
                },
              ].map((card) => (
                <button
                  type="button"
                  key={card.id}
                  className="kanban-card done text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="card-id">{card.id}</span>
                    <span className={`font-mono text-[10px] ${card.vClass}`}>
                      {card.v}
                    </span>
                  </div>
                  <div className="card-title">{card.title}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className={card.metaClass}>{card.meta}</span>
                    <span
                      className={`avatar ${card.avatarClass} h-4 w-4 text-[8px]`}
                    >
                      {card.initial}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="add-card">
              <Plus className="size-3" />
              Add deployment
            </div>
          </div>
        </div>
      </Section>

      <footer className="mt-16 border-t border-dash-border pt-6 text-[11px] font-mono text-fg-faint">
        <p>
          Foundation PR · Hub v1 dark-only · Light + Tokyo Night ship as
          follow-up changes
        </p>
      </footer>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/primitive-sandbox")({
  component: HubSandbox,
})
