import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flink-reactor/ui"
import { format } from "date-fns"
import { Copy, X } from "lucide-react"
import { useMemo, useState } from "react"
import { StackTrace } from "@/components/errors/stack-trace"
import { SeverityBadge } from "@/components/shared/severity-badge"
import { SourceBadge } from "@/components/shared/source-badge"
import { cn } from "@/lib/cn"
import { useLogStore } from "@/stores/log-store"
import { useUiStore } from "@/stores/ui-store"

// ---------------------------------------------------------------------------
// Detail field — flex row with label/value (mirrors error-detail pattern)
// ---------------------------------------------------------------------------

function DetailField({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-zinc-500">{label}</span>
      <span className={cn("min-w-0 text-zinc-200", mono && "font-mono")}>
        {children}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LogDetailPanel() {
  const selectedEntryId = useUiStore((s) => s.selectedEntryId)
  const setSelectedEntryId = useUiStore((s) => s.setSelectedEntryId)
  const entries = useLogStore((s) => s.entries)

  const entry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  )

  // Context: ±5 entries
  const contextLines = useMemo(() => {
    if (!entry) return []
    const idx = entries.indexOf(entry)
    if (idx === -1) return []
    const start = Math.max(0, idx - 5)
    const end = Math.min(entries.length, idx + 6)
    return entries.slice(start, end)
  }, [entries, entry])

  function copyRaw() {
    if (entry) {
      navigator.clipboard.writeText(entry.raw)
    }
  }

  const [activeTab, setActiveTab] = useState("details")

  if (!entry) return null

  return (
    <div className="flex h-full flex-col overflow-hidden bg-dash-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dash-border px-3 py-2">
        <span className="text-xs font-medium text-zinc-300">Log Detail</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyRaw}
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
            title="Copy raw log text"
          >
            <Copy className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedEntryId(null)}
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="details" className="detail-tab">
            Details
          </TabsTrigger>
          {entry.stackTrace && (
            <TabsTrigger value="stacktrace" className="detail-tab">
              Trace
            </TabsTrigger>
          )}
          <TabsTrigger value="context" className="detail-tab">
            Context
          </TabsTrigger>
          <TabsTrigger value="raw" className="detail-tab">
            Raw
          </TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent
          value="details"
          className="flex flex-1 flex-col gap-4 overflow-auto p-4"
        >
          {/* Severity + Source header */}
          <div className="flex items-center gap-2">
            <SeverityBadge level={entry.level} />
            <SourceBadge source={entry.source} />
          </div>

          {/* Message */}
          <div className="rounded bg-black/30 p-3">
            <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-200">
              {entry.message}
            </p>
          </div>

          {/* Metadata fields */}
          <div className="space-y-2">
            <DetailField label="Timestamp" mono>
              {format(entry.timestamp, "yyyy-MM-dd HH:mm:ss.SSS")}
            </DetailField>
            <DetailField label="Logger" mono>
              <span className="break-all">{entry.logger}</span>
            </DetailField>
            <DetailField label="Short Name">{entry.loggerShort}</DetailField>
            <DetailField label="Thread" mono>
              {entry.thread}
            </DetailField>
            <DetailField label="Source">
              <SourceBadge source={entry.source} />
            </DetailField>
            <DetailField label="Level">
              <SeverityBadge level={entry.level} />
            </DetailField>
            {entry.stackTrace && (
              <DetailField label="Stack Trace">
                <button
                  type="button"
                  onClick={() => setActiveTab("stacktrace")}
                  className="text-fr-coral underline underline-offset-2 transition-colors hover:text-fr-coral/80"
                >
                  View Trace
                </button>
              </DetailField>
            )}
          </div>
        </TabsContent>

        {/* Stack Trace tab */}
        {entry.stackTrace && (
          <TabsContent value="stacktrace" className="flex-1 overflow-auto p-4">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">
              Stack Trace
            </h3>
            <StackTrace raw={entry.stackTrace} />
          </TabsContent>
        )}

        {/* Context tab */}
        <TabsContent value="context" className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-xs font-medium text-zinc-400">
            Surrounding Lines
          </h3>
          <div className="rounded bg-black/30 p-3">
            {contextLines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "font-mono text-[11px] leading-relaxed",
                  line.id === entry.id ? "text-white" : "text-zinc-500",
                )}
              >
                <span className="text-zinc-600">
                  {format(line.timestamp, "HH:mm:ss.SSS")}
                </span>{" "}
                <span
                  className={cn(
                    line.level === "ERROR" && "text-log-error",
                    line.level === "WARN" && "text-log-warn",
                  )}
                >
                  {line.level.padEnd(5)}
                </span>{" "}
                {line.message.substring(0, 80)}
                {line.message.length > 80 ? "..." : ""}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Raw tab */}
        <TabsContent value="raw" className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-xs font-medium text-zinc-400">Raw Output</h3>
          <pre className="whitespace-pre-wrap rounded bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {entry.raw}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  )
}
