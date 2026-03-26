/**
 * @module tap-error-panel
 *
 * Error display panel for TAP SQL Gateway errors. Parses Java exception
 * strings into structured sections (class, message, stack frames, "Caused by"
 * chains) with syntax-aware formatting. Framework stack frames are dimmed
 * while user code frames are highlighted. Supports copy-to-clipboard and retry.
 */

import { AlertTriangle, Check, Copy, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/cn"

interface TapErrorPanelProps {
  /** Raw error message string, potentially a Java exception with stack trace. */
  error: string
  /** Callback to retry the failed observation. */
  onRetry: () => void
}

/**
 * Formats a SQL Gateway exception for display in the tap panel.
 * Extracts the exception class, message, and any "Caused by" chain.
 */
function parseException(raw: string): {
  className: string | null
  message: string
  hasStackTrace: boolean
  lines: ParsedLine[]
} {
  const lines = raw.split("\n")
  const parsed: ParsedLine[] = []

  // Check if the first line looks like a Java exception: ClassName: message
  const headerMatch = lines[0]?.match(
    /^([\w$.]+(?:Exception|Error|Throwable))\s*:\s*(.*)/,
  )

  const className = headerMatch ? headerMatch[1] : null
  const message = headerMatch ? headerMatch[2] : (lines[0] ?? raw)

  let hasStackTrace = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.match(/^\s+at\s+/)) {
      hasStackTrace = true
      parsed.push({
        type: "frame",
        text: line.trimStart(),
        isFramework: isFrameworkFrame(line),
      })
    } else if (line.match(/^\s*Caused by:\s*/)) {
      parsed.push({ type: "caused-by", text: line.trim() })
    } else if (line.match(/^\s*\.\.\.\s*\d+\s+more/)) {
      parsed.push({ type: "elided", text: line.trimStart() })
    } else if (i > 0) {
      parsed.push({ type: "text", text: line })
    }
  }

  return { className, message, hasStackTrace, lines: parsed }
}

/** Discriminated union for parsed lines in a Java stack trace. */
type ParsedLine =
  | { type: "frame"; text: string; isFramework: boolean }
  | { type: "caused-by"; text: string }
  | { type: "elided"; text: string }
  | { type: "text"; text: string }

/** Package prefixes considered framework code (dimmed in stack traces). */
const FRAMEWORK_PREFIXES = [
  "org.apache.flink.",
  "java.",
  "javax.",
  "sun.",
  "jdk.",
  "scala.",
  "akka.",
  "io.netty.",
  "org.apache.kafka.common.",
]

/** Returns true if the stack frame belongs to a known framework package. */
function isFrameworkFrame(frame: string): boolean {
  const match = frame.match(/^\s+at\s+([\w.$]+)/)
  if (!match) return false
  return FRAMEWORK_PREFIXES.some((prefix) => match[1].startsWith(prefix))
}

/**
 * Error display with parsed exception header, collapsible stack trace,
 * copy-to-clipboard, and retry button.
 */
export function TapErrorPanel({ error, onRetry }: TapErrorPanelProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const parsed = useMemo(() => parseException(error), [error])

  function handleCopy() {
    navigator.clipboard.writeText(error)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="glass-card overflow-hidden border border-job-failed/20">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-dash-border/50 px-3 py-2">
        <AlertTriangle className="size-3.5 shrink-0 text-job-failed" />
        <span className="text-xs font-medium text-job-failed">
          SQL Gateway Error
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
            title="Copy error"
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-dash-hover hover:text-zinc-200"
            title="Retry"
          >
            <RotateCcw className="size-3" />
            Retry
          </button>
        </div>
      </div>

      {/* Error body */}
      <div className="px-3 py-2.5">
        {/* Exception class + message */}
        <div className="font-mono text-xs leading-relaxed">
          {parsed.className && (
            <span className="text-job-failed/70">{parsed.className}: </span>
          )}
          <span className="text-zinc-200">{parsed.message}</span>
        </div>

        {/* Stack trace (collapsible) */}
        {parsed.hasStackTrace && (
          <>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {expanded ? "Hide stack trace" : "Show stack trace"}
            </button>

            {expanded && (
              <div className="mt-1.5 rounded bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed">
                {parsed.lines.map((line) => {
                  const key = `${line.type}-${line.text}`
                  if (line.type === "caused-by") {
                    return (
                      <div key={key} className="mt-1 text-job-failed/80">
                        {line.text}
                      </div>
                    )
                  }
                  if (line.type === "elided") {
                    return (
                      <div key={key} className="italic text-zinc-600">
                        {line.text}
                      </div>
                    )
                  }
                  if (line.type === "frame") {
                    return (
                      <div
                        key={key}
                        className={cn(
                          line.isFramework ? "text-zinc-600" : "text-zinc-300",
                        )}
                      >
                        {line.text}
                      </div>
                    )
                  }
                  // plain text
                  return (
                    <div key={key} className="text-zinc-400">
                      {line.text}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
