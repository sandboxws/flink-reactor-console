"use client"

import { Check, Copy } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------
// TextViewer — readonly monospace text pane with line numbers and copy button
// ---------------------------------------------------------------------------

export function TextViewer({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const lines = text.split("\n")

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-dash-border bg-dash-surface",
        className,
      )}
    >
      {/* Copy button */}
      <div className="absolute right-2 top-2 z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-dash-elevated p-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {copied ? (
                  <Check className="size-3.5 text-job-running" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy all"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Scrollable text area */}
      <div
        ref={containerRef}
        className="scrollbar-hide max-h-[480px] overflow-auto p-3 pr-10 font-mono text-[13px] leading-6"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-4 inline-block w-8 shrink-0 select-none text-right text-zinc-600">
              {i + 1}
            </span>
            <span className="min-w-0 break-all text-zinc-300">{line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
