/**
 * TypePicker — step 1 of the Connect Instrument wizard. Server-supported types
 * are selectable; aspirational types (Pinot, Druid, custom) render disabled.
 */

import { INSTRUMENT_TYPES } from "./field-spec"

interface TypePickerProps {
  value: string | null
  onSelect: (type: string) => void
}

export function TypePicker({ value, onSelect }: TypePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {INSTRUMENT_TYPES.map((t) =>
        t.supported ? (
          <button
            key={t.value}
            type="button"
            onClick={() => onSelect(t.value)}
            className={
              "rounded-lg border p-3 text-left transition-colors " +
              (t.value === value
                ? "border-fr-coral bg-fr-coral/5"
                : "border-dash-border hover:border-fr-coral/40")
            }
          >
            <div className="font-sans text-[13px] text-zinc-100">{t.label}</div>
            <div className="font-mono text-[10px] text-fg-faint">{t.value}</div>
          </button>
        ) : (
          <div
            key={t.value}
            className="rounded-lg border border-dashed border-dash-border p-3 opacity-50"
            aria-disabled="true"
          >
            <div className="font-sans text-[13px] text-fg-muted">{t.label}</div>
            <div className="font-mono text-[10px] text-fg-faint">{t.note}</div>
          </div>
        ),
      )}
    </div>
  )
}
