/**
 * @module tm-thread-dump-tab
 *
 * Task manager thread dump viewer tab that parses raw thread info strings
 * into structured thread entries and delegates rendering to the shared
 * {@link ThreadDumpViewer} component.
 */
import { Cpu } from "lucide-react"
import { useCallback, useMemo } from "react"
import { EmptyState, ThreadDumpViewer } from "@flink-reactor/ui"
import type { ThreadDumpInfo } from "@flink-reactor/ui"
import { parseThreadInfos } from "@/data/thread-dump-parser"

/**
 * Parses and displays a task manager thread dump via {@link ThreadDumpViewer}.
 *
 * Raw {@link ThreadDumpInfo} thread info strings are parsed into structured
 * thread entries on mount. Provides a "copy all" action that copies the raw
 * stringified thread info to the clipboard. Shows an empty state when no
 * thread dump data is available.
 */
export function TmThreadDumpTab({
  threadDump,
}: {
  threadDump: ThreadDumpInfo
}) {
  const threads = useMemo(
    () => parseThreadInfos(threadDump.threadInfos),
    [threadDump.threadInfos],
  )

  const handleCopyAll = useCallback(() => {
    const raw = threadDump.threadInfos
      .map((info) => info.stringifiedThreadInfo)
      .join("\n\n")
    navigator.clipboard.writeText(raw)
  }, [threadDump.threadInfos])

  if (threads.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState icon={Cpu} message="Thread dump not yet available" />
      </div>
    )
  }

  return (
    <div className="pt-4">
      <ThreadDumpViewer threads={threads} onCopyAll={handleCopyAll} />
    </div>
  )
}
