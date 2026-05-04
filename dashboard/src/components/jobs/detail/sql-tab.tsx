/**
 * @module sql-tab
 *
 * Displays the source SQL of a Flink SQL job (when available) on the job
 * detail page. Reads from `jobConfig.userConfig` using a fixed key priority:
 * `pipeline.sql` → `sql.statement` → `flinkreactor.sql`. Renders a read-only
 * CodeMirror viewer with the same theme system as the sandbox section.
 *
 * Flink does not preserve the source SQL in any REST endpoint by default, so
 * the tab will show its empty state for any job whose submitter did not set
 * one of the supported user-config keys.
 */

import { Button, EmptyState } from "@flink-reactor/ui"
import type { JobUserConfig } from "@flink-reactor/ui"
import { Check, Copy, FileCode2 } from "lucide-react"
import { useCallback, useState } from "react"
import { SqlCodeViewer } from "@/components/shared/sql-code-viewer"

/**
 * SQL is round-tripped via Flink's `pipeline.global-job-parameters` map, which
 * lands as keys on `/jobs/:id/config` user-config. The base64 variant
 * (`pipeline.sql.b64`) is the wire format used by the dsl deploy path and the
 * console SQL Gateway resolver — it sidesteps colon/comma/newline collisions
 * with Flink's mapType parser. The plain variants are kept as fallbacks for
 * jobs whose submitter sets the SQL directly via custom Java code.
 */
const SQL_KEYS_ENCODED = ["pipeline.sql.b64"] as const
const SQL_KEYS_RAW = ["pipeline.sql", "sql.statement", "flinkreactor.sql"] as const

function decodeBase64Utf8(value: string): string | null {
  try {
    if (typeof atob === "function") {
      const binary = atob(value)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    }
    // Node fallback (used by Vitest in node env).
    // biome-ignore lint/suspicious/noExplicitAny: Buffer is a Node global, not a TS type here
    const Buf = (globalThis as any).Buffer
    if (Buf) return Buf.from(value, "base64").toString("utf-8")
    return null
  } catch {
    return null
  }
}

export function extractSql(
  uc: Record<string, string> | undefined,
): { key: string; sql: string } | null {
  if (!uc) return null
  for (const key of SQL_KEYS_ENCODED) {
    const raw = uc[key]
    if (!raw || raw.trim().length === 0) continue
    const decoded = decodeBase64Utf8(raw.trim())
    if (decoded && decoded.trim().length > 0) return { key, sql: decoded }
  }
  for (const key of SQL_KEYS_RAW) {
    const raw = uc[key]
    if (raw && raw.trim().length > 0) return { key, sql: raw }
  }
  return null
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
      className="h-7 gap-1.5 text-xs"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

export function SqlTab({ jobConfig }: { jobConfig: JobUserConfig | null }) {
  const found = extractSql(jobConfig?.userConfig)

  if (!found) {
    return (
      <div className="glass-card flex min-h-0 flex-1 items-center justify-center">
        <EmptyState
          icon={FileCode2}
          title="SQL not available"
          description="Flink does not preserve the source SQL by default. To see it here, the job submitter must set pipeline.sql, sql.statement, or flinkreactor.sql in the job's user-config when submitting."
        />
      </div>
    )
  }

  return (
    <div className="glass-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-dash-border px-3 py-1.5">
        <span className="font-mono text-[11px] text-zinc-500">
          source: <span className="text-zinc-300">{found.key}</span>
        </span>
        <CopyButton text={found.sql} />
      </div>
      <div className="min-h-0 flex-1">
        <SqlCodeViewer value={found.sql} />
      </div>
    </div>
  )
}
