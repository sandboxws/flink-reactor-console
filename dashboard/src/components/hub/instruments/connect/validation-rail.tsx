/**
 * ValidationRail — the right-rail summary for the Connect Instrument wizard:
 * a required-field checklist plus the live connection-test result.
 */

import { AlertCircle, Check, X } from "lucide-react"
import type { InstrumentTestResult } from "@/lib/instruments-data"

interface ValidationRailProps {
  type: string | null
  nameMissing: boolean
  missing: string[]
  testResult: InstrumentTestResult | null
  testing: boolean
}

export function ValidationRail({
  type,
  nameMissing,
  missing,
  testResult,
  testing,
}: ValidationRailProps) {
  return (
    <div className="glass-card-static sticky top-4 space-y-4 p-5">
      <h3 className="section-heading">Validation</h3>

      {type === null ? (
        <p className="text-[11.5px] text-fg-muted">
          Pick a connector to begin.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[11.5px]">
          <CheckRow ok={!nameMissing} label="Instrument name" />
          {missing.length === 0 ? (
            <CheckRow ok label="Required fields complete" />
          ) : (
            missing.map((m) => <CheckRow key={m} ok={false} label={m} />)
          )}
        </ul>
      )}

      {testing ? (
        <p className="text-[11.5px] font-mono text-fg-faint">
          Testing connection…
        </p>
      ) : testResult ? (
        testResult.ok ? (
          <div className="rounded-md border border-fr-sage/30 bg-fr-sage/5 px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-1.5 text-fr-sage">
              <Check className="size-3.5" /> Connection ok
            </div>
            {testResult.latencyMs !== null ? (
              <div className="mt-1 font-mono text-[10.5px] text-fg-muted">
                {testResult.latencyMs} ms
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-1.5 text-fr-rose">
              <X className="size-3.5" /> Connection failed
            </div>
            {testResult.message ? (
              <div className="mt-1 break-words font-mono text-[10.5px] text-fg-muted">
                {testResult.message}
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <Check className="size-3.5 shrink-0 text-fr-sage" />
      ) : (
        <AlertCircle className="size-3.5 shrink-0 text-fr-amber" />
      )}
      <span className={ok ? "text-fg-muted" : "text-fg"}>{label}</span>
    </li>
  )
}
