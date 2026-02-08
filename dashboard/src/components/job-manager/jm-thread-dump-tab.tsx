"use client";

import { useMemo } from "react";
import { Cpu } from "lucide-react";
import type { ThreadDumpInfo } from "@/data/cluster-types";
import { parseThreadInfos } from "@/data/thread-dump-parser";
import { ThreadDumpViewer } from "@/components/shared/thread-dump-viewer";
import { EmptyState } from "@/components/shared/empty-state";

export function JmThreadDumpTab({
  threadDump,
}: {
  threadDump: ThreadDumpInfo;
}) {
  const threads = useMemo(
    () => parseThreadInfos(threadDump.threadInfos),
    [threadDump.threadInfos],
  );

  if (threads.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState icon={Cpu} message="Thread dump not yet available" />
      </div>
    );
  }

  return (
    <div className="pt-4">
      <ThreadDumpViewer threads={threads} />
    </div>
  );
}
