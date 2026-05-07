/**
 * SavedQueriesPane — left column of the SQL Explorer.
 *
 * Persists a list of bookmarked queries in `localStorage` under
 * `fr-hub-saved-queries`. Click a row to load it into the editor; trash
 * icon deletes. New entries are added by the parent via the "Save"
 * button on the editor toolbar.
 */

import { Trash2 } from "lucide-react"
import { useEffect } from "react"

const STORAGE_KEY = "fr-hub-saved-queries"

export interface SavedQuery {
  id: string
  name: string
  sql: string
  savedAt: string
}

interface SavedQueriesPaneProps {
  saved: SavedQuery[]
  setSaved: (next: SavedQuery[]) => void
  onLoad: (sql: string) => void
}

export function SavedQueriesPane({
  saved,
  setSaved,
  onLoad,
}: SavedQueriesPaneProps) {
  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
      // ignore (privacy mode, quota)
    }
  }, [saved])

  const remove = (id: string) => {
    setSaved(saved.filter((q) => q.id !== id))
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-dash-border bg-dash-surface/30">
      <div className="flex h-10 shrink-0 items-center border-b border-dash-border px-4">
        <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
          Saved queries
        </h3>
        <span className="ml-auto font-mono text-[10px] text-fg-faint">
          {saved.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {saved.length === 0 ? (
          <p className="px-4 py-3 text-[11px] font-mono text-fg-faint">
            No saved queries yet.
          </p>
        ) : (
          <ul className="divide-y divide-dash-border/40">
            {saved.map((q) => (
              <li
                key={q.id}
                className="group flex items-center gap-2 px-4 py-2"
              >
                <button
                  type="button"
                  onClick={() => onLoad(q.sql)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[12px] text-fg group-hover:text-fr-coral">
                    {q.name}
                  </div>
                  <div className="truncate font-mono text-[10px] text-fg-faint">
                    {q.sql.replace(/\s+/g, " ").trim().slice(0, 80)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(q.id)}
                  className="opacity-0 transition-opacity hover:text-fr-rose group-hover:opacity-100"
                  aria-label={`Delete ${q.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Load saved queries from localStorage; returns empty array on error. */
export function loadSavedQueries(): SavedQuery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (q): q is SavedQuery =>
        q && typeof q.id === "string" && typeof q.sql === "string",
    )
  } catch {
    return []
  }
}
