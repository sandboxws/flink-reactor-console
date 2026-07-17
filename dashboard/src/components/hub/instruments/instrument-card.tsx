/**
 * InstrumentCard — glass-card variant for the /hub/instruments grid.
 *
 * Status conveyed via background tint + a "✓"/"⚠" pill (no left-border
 * accent — Hub design system rule). Type icon picked from a static map so
 * Tailwind can scan the resulting utility classes statically.
 */

import { Link } from "@tanstack/react-router"
import {
  Database,
  FileJson,
  HardDrive,
  Layers,
  type LucideIcon,
  Radio,
} from "lucide-react"
import type { InstrumentInfo } from "@/lib/instruments-data"

const ICON_MAP: Record<string, LucideIcon> = {
  fluss: Layers,
  redis: Database,
  schemaregistry: FileJson,
  database: HardDrive,
  kafka: Radio,
}

const TYPE_LABEL: Record<string, string> = {
  fluss: "Fluss",
  redis: "Redis",
  schemaregistry: "Schema registry",
  database: "Database",
  kafka: "Kafka",
}

interface InstrumentCardProps {
  instrument: InstrumentInfo
}

export function InstrumentCard({ instrument }: InstrumentCardProps) {
  const Icon = ICON_MAP[instrument.type] ?? Database
  const label = TYPE_LABEL[instrument.type] ?? instrument.type
  const href = instrumentIndexHref(instrument)

  const body = (
    <article
      className={
        "glass-card-static flex flex-col gap-3 p-4 text-left transition-colors " +
        (instrument.healthy
          ? "hover:border-fr-sage/40"
          : "border-fr-amber/30 bg-fr-amber/[0.03] hover:border-fr-amber/40")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon
            className={
              instrument.healthy
                ? "size-5 text-fr-sage"
                : "size-5 text-fr-amber"
            }
          />
          <div>
            <h3 className="font-sans text-[13.5px] font-medium text-zinc-100">
              {instrument.displayName}
            </h3>
            <p className="font-mono text-[10px] text-fg-faint">
              {label} · v{instrument.version || "?"}
            </p>
          </div>
        </div>
        <span
          className={instrument.healthy ? "sev-badge ok" : "sev-badge warn"}
        >
          {instrument.healthy ? "✓ healthy" : "⚠ degraded"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {instrument.capabilities.slice(0, 4).map((cap) => (
          <span key={cap} className="prop-chip">
            {cap}
          </span>
        ))}
        {instrument.capabilities.length > 4 ? (
          <span className="prop-chip">
            +{instrument.capabilities.length - 4}
          </span>
        ) : null}
      </div>
    </article>
  )

  if (!href) return body

  return (
    <Link to={href} className="block">
      {body}
    </Link>
  )
}

/** Map an instrument's `type` to its Hub index route (or null if unrouted). */
function instrumentIndexHref(instrument: InstrumentInfo): string | null {
  switch (instrument.type) {
    case "fluss":
      return `/hub/instruments/${instrument.name}/fluss`
    case "redis":
      return `/hub/instruments/${instrument.name}/redis`
    case "schemaregistry":
      return `/hub/instruments/${instrument.name}/schema-registry`
    case "database":
      return `/hub/instruments/${instrument.name}/database`
    case "kafka":
      return `/hub/instruments/${instrument.name}/kafka`
    default:
      return null
  }
}
