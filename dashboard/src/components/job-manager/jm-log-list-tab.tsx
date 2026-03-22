import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  FileText,
  Loader2,
  Maximize,
  Minimize,
  RefreshCw,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StaticLogExplorer } from "@flink-reactor/ui"
import type { LogFileEntry } from "@flink-reactor/ui"
import { parseLogBlock } from "@/data/log-parser"
import type { LogSource } from "@flink-reactor/ui"
import { fetchJobManagerLogFile } from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = "name" | "lastModified" | "size"
type SortDir = "asc" | "desc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(date: Date): string {
  const yyyy = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const HH = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  const ms = String(date.getMilliseconds()).padStart(3, "0")
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}.${ms}`
}

function comparator(field: SortField, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1
  return (a: LogFileEntry, b: LogFileEntry): number => {
    if (field === "name") return mul * a.name.localeCompare(b.name)
    if (field === "lastModified")
      return mul * (a.lastModified.getTime() - b.lastModified.getTime())
    return mul * (a.size - b.size)
  }
}

/** Derive a LogSource from a log filename. */
function sourceFromFileName(fileName: string): LogSource {
  if (fileName.includes("taskexecutor")) {
    return { type: "taskmanager", id: "tm-0", label: "TaskManager 0" }
  }
  if (fileName.includes("client")) {
    return { type: "client", id: "client", label: "Client" }
  }
  return { type: "jobmanager", id: "jm", label: "JobManager" }
}

// ---------------------------------------------------------------------------
// SortHeader — clickable column header with direction indicator
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  field,
  activeField,
  dir,
  onSort,
  align = "left",
}: {
  label: string
  field: SortField
  activeField: SortField
  dir: SortDir
  onSort: (f: SortField) => void
  align?: "left" | "right"
}) {
  const active = field === activeField
  return (
    <th
      className={`cursor-pointer select-none px-4 py-2 font-medium transition-colors hover:text-zinc-300 ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-zinc-300" : "text-zinc-500"}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          ))}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// LogViewer — detail view for a single log file using StaticLogExplorer
// ---------------------------------------------------------------------------

function LogViewer({
  fileName,
  onBack,
}: {
  fileName: string
  onBack: () => void
}) {
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadContent = useCallback(async () => {
    setLoading(true)
    try {
      const text = await fetchJobManagerLogFile(fileName)
      setRawContent(text)
    } catch {
      setRawContent("")
    } finally {
      setLoading(false)
    }
  }, [fileName])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  // Parse raw log content into structured LogEntry[]
  const entries = useMemo(() => {
    if (!rawContent) return []
    const source = sourceFromFileName(fileName)
    const { entries } = parseLogBlock(rawContent, source)
    return entries
  }, [rawContent, fileName])

  const handleReload = useCallback(() => {
    loadContent()
  }, [loadContent])

  const handleDownload = useCallback(() => {
    const raw = entries.map((e) => e.raw).join("\n")
    const blob = new Blob([raw], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [entries, fileName])

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col gap-3 bg-dash-bg">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft className="size-3" />
            Log List
          </button>
          <span className="text-xs text-zinc-600">/</span>
          <span className="truncate font-mono text-xs text-zinc-300">
            {fileName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleReload}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-dash-hover hover:text-zinc-300"
            title="Reload"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-dash-hover hover:text-zinc-300"
            title="Download"
          >
            <Download className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-dash-hover hover:text-zinc-300"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="size-3.5" />
            ) : (
              <Maximize className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Log content — unified explorer view */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-zinc-500" />
        </div>
      ) : (
        <StaticLogExplorer
          entries={entries}
          className={isFullscreen ? "h-screen" : "h-[calc(100vh-12rem)]"}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// JmLogListTab — file list table with drill-down log viewer
// ---------------------------------------------------------------------------

export function JmLogListTab({
  logFiles,
  selectedLog,
  onSelectLog,
}: {
  logFiles: LogFileEntry[]
  selectedLog: string | null
  onSelectLog: (name: string | null) => void
}) {
  const [sortField, setSortField] = useState<SortField>("lastModified")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDir(field === "name" ? "asc" : "desc")
      }
    },
    [sortField],
  )

  const sorted = useMemo(
    () => [...logFiles].sort(comparator(sortField, sortDir)),
    [logFiles, sortField, sortDir],
  )

  // Drill-down view
  if (selectedLog) {
    return (
      <div className="pt-4">
        <LogViewer fileName={selectedLog} onBack={() => onSelectLog(null)} />
      </div>
    )
  }

  // List view
  return (
    <div className="pt-4">
      <div className="glass-card overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
          <FileText className="size-3.5 text-zinc-500" />
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Log List
          </h3>
          <span className="ml-auto font-mono text-[10px] text-zinc-600">
            {logFiles.length} files
          </span>
        </div>

        {/* Log file table */}
        <div className="min-h-[200px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border">
                <SortHeader
                  label="Log Name"
                  field="name"
                  activeField={sortField}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Last Modified Time"
                  field="lastModified"
                  activeField={sortField}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Size (KB)"
                  field="size"
                  activeField={sortField}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <tr
                  key={entry.name}
                  className="cursor-pointer border-b border-dash-border/50 even:bg-dash-panel transition-colors hover:bg-dash-hover"
                  onClick={() => onSelectLog(entry.name)}
                >
                  <td className="px-4 py-2 font-mono text-fr-purple">
                    {entry.name}
                  </td>
                  <td className="px-4 py-2 font-mono tabular-nums text-zinc-400">
                    {formatDateTime(entry.lastModified)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-400">
                    {entry.size.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logFiles.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-zinc-500">
              No log files available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
