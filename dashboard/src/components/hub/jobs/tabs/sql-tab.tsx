/**
 * Hub SQL tab — renders the source SQL of a SQL-submitted job inside a Hub
 * glass-card-static frame. Reuses `extractSql()` from the legacy tab so the
 * base64-decoding and key-priority logic stay shared.
 */

import type { JobUserConfig } from "@flink-reactor/ui"
import { Button } from "@flink-reactor/ui"
import { Check, Copy } from "lucide-react"
import { useCallback, useState } from "react"
import { extractSql } from "@/components/jobs/detail/sql-tab"
import { SqlCodeViewer } from "@/components/shared/sql-code-viewer"

/** Returns the SQL payload + source key when the job carries one, else null. */
export function getJobSql(jobConfig: JobUserConfig | null) {
  return extractSql(jobConfig?.userConfig)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onClick = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title="Copy SQL to clipboard"
      className="h-7 gap-1.5 text-[11px]"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

export function HubSqlTab({ jobConfig }: { jobConfig: JobUserConfig | null }) {
  const found = getJobSql(jobConfig)
  if (!found) return null

  return (
    <div className="glass-card-static flex flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-dash-border px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="font-sans text-[13px] font-medium text-zinc-100">
            Source SQL
          </h3>
          <span className="font-mono text-[10px] text-fg-faint">
            via <span className="text-fg-muted">{found.key}</span>
          </span>
        </div>
        <CopyButton text={found.sql} />
      </div>
      <div className="min-h-[420px]">
        <SqlCodeViewer value={found.sql} />
      </div>
    </div>
  )
}
