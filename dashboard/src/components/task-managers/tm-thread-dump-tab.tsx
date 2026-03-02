"use client"

import { Cpu } from "lucide-react"
import { useCallback, useMemo } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { ThreadDumpViewer } from "@/components/shared/thread-dump-viewer"
import type { ThreadDumpInfo } from "@/data/cluster-types"
import { parseThreadInfos } from "@/data/thread-dump-parser"

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
