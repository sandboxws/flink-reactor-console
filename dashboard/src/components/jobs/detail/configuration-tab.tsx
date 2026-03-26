/**
 * @module configuration-tab
 *
 * Job runtime configuration tab displaying all key-value configuration entries
 * grouped by their dotted prefix namespace. Includes a search filter and
 * click-to-copy on values. Groups are collapsible and sorted alphabetically.
 */

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
} from "@flink-reactor/ui"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Search,
  Settings,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { JobConfiguration } from "@flink-reactor/ui"

// ---------------------------------------------------------------------------
// Copy-on-click value
// ---------------------------------------------------------------------------

/** Clickable value that copies text to clipboard with visual confirmation. */
function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex items-center gap-1.5 text-left font-mono text-xs text-zinc-300 transition-colors hover:text-zinc-100"
      title="Click to copy"
    >
      <span className="break-all">{value}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-job-running" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500" />
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Config group
// ---------------------------------------------------------------------------

/** Collapsible section grouping configuration entries that share a dotted-prefix namespace. */
function ConfigGroup({
  prefix,
  entries,
  defaultOpen,
}: {
  prefix: string
  entries: JobConfiguration[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-dash-hover">
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
        )}
        <span>{prefix}</span>
        <span className="ml-auto text-[10px] tabular-nums text-zinc-600">
          {entries.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <table className="w-full text-xs">
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.key}
                className="border-b border-dash-border/30 transition-colors hover:bg-dash-hover/50"
              >
                <td className="w-1/2 px-3 py-1.5 pl-9 font-mono text-zinc-400">
                  {entry.key}
                </td>
                <td className="w-1/2 px-3 py-1.5">
                  <CopyableValue value={entry.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// ConfigurationTab
// ---------------------------------------------------------------------------

/**
 * Searchable, grouped display of all job configuration key-value pairs.
 * Groups entries by their first dotted prefix (e.g. "state", "execution")
 * into collapsible sections. Each value is click-to-copy.
 */
export function ConfigurationTab({
  configuration,
}: {
  configuration: JobConfiguration[]
}) {
  const [search, setSearch] = useState("")

  const { groups, filteredCount } = useMemo(() => {
    const searchLower = search.toLowerCase()
    const filtered = search
      ? configuration.filter(
          (c) =>
            c.key.toLowerCase().includes(searchLower) ||
            c.value.toLowerCase().includes(searchLower),
        )
      : configuration

    // Group by first dotted prefix
    const map = new Map<string, JobConfiguration[]>()
    for (const entry of filtered) {
      const dotIdx = entry.key.indexOf(".")
      const prefix = dotIdx > 0 ? entry.key.slice(0, dotIdx) : entry.key
      const existing = map.get(prefix)
      if (existing) {
        existing.push(entry)
      } else {
        map.set(prefix, [entry])
      }
    }

    // Sort groups alphabetically
    const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    return {
      groups: sorted,
      filteredCount: filtered.length,
    }
  }, [configuration, search])

  if (configuration.length === 0) {
    return <EmptyState icon={Settings} message="No configuration available" />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search configuration..."
          className="h-8 w-full rounded-md border border-dash-border bg-dash-surface pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-fr-purple focus:outline-none"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-600">
            {filteredCount} / {configuration.length}
          </span>
        )}
      </div>

      {/* Grouped config */}
      <div className="glass-card divide-y divide-dash-border/50 overflow-hidden">
        {groups.length > 0 ? (
          groups.map(([prefix, entries]) => (
            <ConfigGroup
              key={prefix}
              prefix={prefix}
              entries={entries}
              defaultOpen
            />
          ))
        ) : (
          <div className="px-3 py-8 text-center text-xs text-zinc-500">
            No matching configuration entries
          </div>
        )}
      </div>
    </div>
  )
}
