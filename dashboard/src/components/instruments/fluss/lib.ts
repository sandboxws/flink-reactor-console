import type { FlussTableType } from "@/lib/instruments/types"

// Badge styles for the PrimaryKey vs Log distinction. Matches the spec
// requirement that the dashboard render a badge per table type.
export const FLUSS_TABLE_TYPE_BADGE: Record<FlussTableType, string> = {
  PrimaryKey: "bg-emerald-500/15 text-emerald-300",
  Log: "bg-sky-500/15 text-sky-300",
}

// formatLastUpdated renders a millisecond epoch as a short relative or
// absolute date depending on age. < 1d → relative ("3h ago"), else ISO date.
export function formatLastUpdated(ms: number): string {
  if (!ms || ms <= 0) return "—"
  const now = Date.now()
  const diff = now - ms
  if (diff < 0) return new Date(ms).toISOString().slice(0, 10)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(ms).toISOString().slice(0, 10)
}
