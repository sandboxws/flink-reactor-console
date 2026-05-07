/**
 * RedisKeyBrowser — scan-based key browser for a Redis instrument.
 *
 * Pattern input + cursor-based scan with "Load more". Click a key to
 * navigate to the detail route via `?key=...` search param.
 */

import { Link } from "@tanstack/react-router"
import { Key, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { scanRedisKeys } from "@/lib/instruments-data"

interface RedisKeyBrowserProps {
  instrument: string
}

export function RedisKeyBrowser({ instrument }: RedisKeyBrowserProps) {
  const [pattern, setPattern] = useState("")
  const [keys, setKeys] = useState<string[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setKeys([])
    setCursor(null)
    setHasMore(false)
    setError(null)
  }

  const scan = async (next: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await scanRedisKeys(
        instrument,
        next ? cursor : null,
        pattern || null,
        100,
      )
      setKeys((prev) => (next ? [...prev, ...res.keys] : res.keys))
      setCursor(res.cursor)
      setHasMore(res.hasMore)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scan(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    reset()
    scan(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        className="glass-card-static flex items-center gap-2 p-3"
      >
        <Search className="size-4 text-fg-faint" />
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="MATCH pattern (e.g. user:*)"
          className="flex-1 bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-fg-faint"
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          Scan
        </button>
      </form>

      {error ? (
        <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
      ) : null}

      <div className="glass-card-static overflow-hidden">
        <div className="flex items-center justify-between border-b border-dash-border px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
          <span>Keys</span>
          <span>{keys.length} loaded</span>
        </div>
        {keys.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11.5px] font-mono text-fg-faint">
            {loading ? "Scanning…" : "No keys match this pattern."}
          </p>
        ) : (
          <ul className="divide-y divide-dash-border/40 max-h-[480px] overflow-y-auto">
            {keys.map((k) => (
              <li key={k}>
                <Link
                  to="/hub/instruments/$instrumentName/redis/key"
                  params={{ instrumentName: instrument }}
                  search={{ key: k }}
                  className="flex items-center gap-2 px-4 py-1.5 text-[12px] font-mono hover:bg-dash-elevated/30"
                >
                  <Key className="size-3 text-fr-coral" />
                  <span className="truncate text-fg">{k}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hasMore ? (
          <div className="border-t border-dash-border px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => scan(true)}
              disabled={loading}
              className="text-[11px] text-fr-coral hover:underline disabled:opacity-60"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
