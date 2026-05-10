/**
 * Instrument health list — placeholder card showing demo rows for Fluss /
 * Paimon / Redis / Schema Registry / Datalake until the P4 instrument store
 * lands and feeds real status. Renders at 60% opacity with a "wired in P4"
 * note, matching the mockup affordance for unfinished data sources.
 */

import { Link } from "@tanstack/react-router"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

type Status = "OK" | "WARN" | "FAIL"

interface InstrumentRow {
  name: string
  status: Status
  sub: string
  latency: string
}

interface InstrumentHealthListProps {
  /** Override demo rows once a live store is wired. */
  rows?: InstrumentRow[]
}

const DEMO_ROWS: InstrumentRow[] = [
  { name: "Fluss", status: "OK", sub: "—", latency: "—" },
  { name: "Paimon", status: "OK", sub: "—", latency: "—" },
  { name: "Redis", status: "OK", sub: "—", latency: "—" },
  { name: "Schema Registry", status: "WARN", sub: "—", latency: "—" },
  { name: "Datalake", status: "OK", sub: "—", latency: "—" },
]

export function InstrumentHealthList({ rows }: InstrumentHealthListProps) {
  const isDemo = !rows
  const items = rows ?? DEMO_ROWS
  return (
    <div className="glass-card-static p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-heading">Instrument health</h3>
        <Link
          to="/hub/instruments"
          className="text-[10px] text-fg-faint hover:text-fr-coral font-mono"
        >
          MANAGE
        </Link>
      </div>
      {isDemo ? (
        <p className="mb-2 text-[10px] font-mono text-fg-faint">
          wired in P4 — live data via <code>useInstrumentStore</code>
        </p>
      ) : null}
      <div className={isDemo ? "space-y-1 opacity-60" : "space-y-1"}>
        {items.map((row) => (
          <InstrumentRowItem key={row.name} {...row} />
        ))}
      </div>
    </div>
  )
}

function InstrumentRowItem({ name, status, sub, latency }: InstrumentRow) {
  const tone =
    status === "OK"
      ? "text-fr-sage"
      : status === "WARN"
        ? "text-fr-amber"
        : "text-fr-rose"
  const Icon = status === "OK" ? CheckCircle2 : AlertTriangle
  return (
    <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 rounded-md p-2 hover:bg-dash-elevated/40">
      <Icon className={`size-4 ${tone}`} />
      <div>
        <div className="text-[12.5px] text-fg">{name}</div>
        <div className="text-[10px] text-fg-faint font-mono">{sub}</div>
      </div>
      <span className={`font-mono text-[10px] ${tone}`}>{status}</span>
      <span className="font-mono text-[10px] text-fg-faint text-right w-10">
        {latency}
      </span>
    </div>
  )
}
