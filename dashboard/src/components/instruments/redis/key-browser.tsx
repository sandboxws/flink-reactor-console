import { Key, Loader2, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { fetchRedisScan } from "../../api"
import type { RedisScanResult } from "../../types"

type LinkProps = {
  to: string
  search?: Record<string, string>
  className?: string
  children: React.ReactNode
}

const SCAN_COUNT = 100

export function KeyBrowser({
  instrumentName,
  LinkComponent,
}: {
  instrumentName: string
  LinkComponent: React.ComponentType<LinkProps>
}) {
  const [pattern, setPattern] = useState("")
  const [pendingPattern, setPendingPattern] = useState("")
  const [keys, setKeys] = useState<string[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runScan = useCallback(
    async (
      currentPattern: string,
      currentCursor: string | null,
      append: boolean,
    ) => {
      setLoading(true)
      setError(null)
      try {
        const result: RedisScanResult = await fetchRedisScan(
          instrumentName,
          currentCursor,
          currentPattern,
          SCAN_COUNT,
        )
        setKeys((prev) => (append ? [...prev, ...result.keys] : result.keys))
        setCursor(result.cursor)
        setHasMore(result.hasMore)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [instrumentName],
  )

  useEffect(() => {
    runScan("", null, false)
  }, [runScan])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPattern(pendingPattern)
    setKeys([])
    setCursor(null)
    setHasMore(false)
    runScan(pendingPattern, null, false)
  }

  const handleLoadMore = () => {
    runScan(pattern, cursor, true)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="glass-card flex items-center gap-2 p-2">
        <Search className="size-3.5 text-zinc-500" />
        <input
          type="text"
          value={pendingPattern}
          onChange={(e) => setPendingPattern(e.target.value)}
          placeholder="Filter pattern (e.g. user:*) — empty matches all"
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.10]"
        >
          Scan
        </button>
      </form>

      {error && (
        <div className="glass-card p-4 text-sm text-job-failed">{error}</div>
      )}

      <div className="glass-card divide-y divide-dash-border">
        {keys.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <Key className="size-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">No keys found</p>
          </div>
        )}

        {keys.map((key) => (
          <LinkComponent
            key={key}
            to={`/instruments/${instrumentName}/redis/key`}
            search={{ key }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-white/[0.03]"
          >
            <Key className="size-3 text-zinc-500" />
            <span className="font-mono text-zinc-200">{key}</span>
          </LinkComponent>
        ))}

        {(loading || hasMore) && (
          <div className="flex items-center justify-center p-3">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-zinc-500" />
            ) : (
              <button
                type="button"
                onClick={handleLoadMore}
                className="rounded-md bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.10]"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
