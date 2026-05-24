import type { JobManagerConfig } from "@flink-reactor/ui"
import { EmptyState } from "@flink-reactor/ui"
import { Search, Settings } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ConfigValue } from "./config-value"
import { classifyConfigKey, TagBadgeHub, TagChipHub } from "./jm-tag-filter-hub"

export function JmConfigSectionHub({ config }: { config: JobManagerConfig[] }) {
  const [search, setSearch] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rowsBelow, setRowsBelow] = useState(0)

  const taggedConfig = useMemo(
    () => config.map((c) => ({ ...c, tag: classifyConfigKey(c.key) })),
    [config],
  )

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of taggedConfig) {
      counts.set(entry.tag, (counts.get(entry.tag) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }))
  }, [taggedConfig])

  const filtered = useMemo(() => {
    let results = taggedConfig
    if (activeTag) {
      results = results.filter((c) => c.tag === activeTag)
    }
    if (search) {
      const lower = search.toLowerCase()
      results = results.filter(
        (c) =>
          c.key.toLowerCase().includes(lower) ||
          c.value.toLowerCase().includes(lower),
      )
    }
    return results
  }, [taggedConfig, activeTag, search])

  const computeRowsBelow = useCallback(() => {
    const el = scrollRef.current
    if (!el || filtered.length === 0) {
      setRowsBelow(0)
      return
    }
    const { scrollTop, scrollHeight, clientHeight } = el
    const remaining = scrollHeight - scrollTop - clientHeight
    if (remaining < 1) {
      setRowsBelow(0)
    } else {
      const rowHeight = scrollHeight / (filtered.length + 1)
      setRowsBelow(Math.ceil(remaining / rowHeight))
    }
  }, [filtered.length])

  useEffect(() => {
    computeRowsBelow()
  }, [computeRowsBelow])

  if (config.length === 0) {
    return <EmptyState icon={Settings} message="No configuration available" />
  }

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
        <Settings className="size-3.5 text-fg-dim" />
        <h3 className="section-heading">Configurations</h3>
        <span className="ml-auto font-mono text-[10px] text-fg-faint">
          {config.length} entries
        </span>
      </div>

      <div className="flex flex-col gap-2 px-4 pt-3 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {tagCounts.map(({ tag, count }) => (
            <TagChipHub
              key={tag}
              tag={tag}
              count={count}
              active={activeTag === tag}
              onClick={() =>
                setActiveTag((prev) => (prev === tag ? null : tag))
              }
            />
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search configuration..."
            className="h-8 w-full rounded-md border border-dash-border bg-dash-surface pl-9 pr-3 text-xs text-fg placeholder:text-fg-faint focus:border-fr-coral focus:outline-none"
          />
          {(search || activeTag) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-fg-faint">
              {filtered.length} / {config.length}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="h-[480px] overflow-y-auto scrollbar-hide"
          onScroll={computeRowsBelow}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border text-[10px] font-mono uppercase tracking-wider text-fg-faint">
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Value</th>
                <th className="px-4 py-2 text-left">Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border/40">
              {filtered.map((entry) => (
                <tr
                  key={entry.key}
                  className="transition-colors even:bg-dash-panel/50 hover:bg-dash-elevated/30"
                >
                  <td className="w-5/12 px-4 py-1.5 font-mono text-fg">
                    {entry.key}
                  </td>
                  <td className="w-5/12 px-4 py-1.5 font-mono break-all">
                    <ConfigValue value={entry.value} />
                  </td>
                  <td className="w-2/12 px-4 py-1.5">
                    <TagBadgeHub tag={entry.tag} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={Settings}
              message="No matching configuration entries"
            />
          )}
        </div>

        <div
          className={`pointer-events-none absolute bottom-0 left-0 right-0 flex h-8 items-end justify-center bg-gradient-to-t from-dash-surface to-transparent pb-1.5 transition-opacity duration-200 ${
            rowsBelow > 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-mono text-[10px] tabular-nums text-fg-dim">
            {rowsBelow} more row{rowsBelow !== 1 ? "s" : ""} below
          </span>
        </div>
      </div>
    </div>
  )
}
