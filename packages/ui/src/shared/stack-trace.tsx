"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible"
import { Check, ChevronRight, Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "../lib/cn"

// ---------------------------------------------------------------------------
// Stack frame categorization
// ---------------------------------------------------------------------------

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

function isFrameworkFrame(frame: string): boolean {
  const match = frame.match(/^\s+at\s+([\w.$]+)/)
  if (!match) return false
  return FRAMEWORK_PREFIXES.some((prefix) => match[1].startsWith(prefix))
}

// ---------------------------------------------------------------------------
// Stack trace parser — splits raw text into structured sections
// ---------------------------------------------------------------------------

interface StackFrame {
  text: string
  isFramework: boolean
}

interface ElidedFrames {
  count: number
  text: string
}

type FrameItem =
  | { type: "frame"; frame: StackFrame }
  | { type: "elided"; elided: ElidedFrames }

interface CausedBySection {
  header: string
  frames: FrameItem[]
}

interface ParsedTrace {
  header: string
  frames: FrameItem[]
  causedBy: CausedBySection[]
}

function parseStackTrace(raw: string): ParsedTrace {
  const lines = raw.split("\n")
  const header = lines[0] || ""
  const frames: FrameItem[] = []
  const causedBy: CausedBySection[] = []

  let current: { header: string; frames: FrameItem[] } | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.match(/^\s*Caused by:/)) {
      if (current) {
        causedBy.push(current)
      }
      current = { header: line.trim(), frames: [] }
      continue
    }

    const elidedMatch = line.match(/^\s*\.\.\.\s*(\d+)\s+more/)
    if (elidedMatch) {
      const item: FrameItem = {
        type: "elided",
        elided: { count: Number(elidedMatch[1]), text: line.trimStart() },
      }
      if (current) {
        current.frames.push(item)
      } else {
        frames.push(item)
      }
      continue
    }

    if (line.match(/^\s+at\s+/)) {
      const item: FrameItem = {
        type: "frame",
        frame: { text: line.trimStart(), isFramework: isFrameworkFrame(line) },
      }
      if (current) {
        current.frames.push(item)
      } else {
        frames.push(item)
      }
    }
  }

  if (current) {
    causedBy.push(current)
  }

  return { header, frames, causedBy }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FrameList({ items }: { items: FrameItem[] }) {
  return (
    <>
      {items.map((item, i) => {
        if (item.type === "elided") {
          return (
            <div key={i} className="text-zinc-600 italic">
              {item.elided.text}
            </div>
          )
        }
        return (
          <div
            key={i}
            className={cn(
              item.frame.isFramework
                ? "text-zinc-600"
                : "font-medium text-zinc-300",
            )}
          >
            {item.frame.text}
          </div>
        )
      })}
    </>
  )
}

function CausedByChain({ section }: { section: CausedBySection }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1 text-log-error/80 hover:text-log-error transition-colors mt-1">
        <ChevronRight
          className={cn("size-3 transition-transform", open && "rotate-90")}
        />
        <span>{section.header}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="collapsible-panel pl-4 pt-0.5">
        <FrameList items={section.frames} />
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StackTrace({ raw }: { raw: string }) {
  const parsed = useMemo(() => parseStackTrace(raw), [raw])
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(raw)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group/trace relative rounded bg-black/30 p-3">
      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded p-1 text-zinc-600 opacity-0 transition-all hover:text-zinc-300 group-hover/trace:opacity-100"
        title="Copy stack trace"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>

      <div className="font-mono text-[11px] leading-relaxed space-y-0">
        {/* Exception header */}
        <div className="font-medium text-log-error">{parsed.header}</div>

        {/* Main frames */}
        <FrameList items={parsed.frames} />

        {/* Caused by chains */}
        {parsed.causedBy.map((section, i) => (
          <CausedByChain key={i} section={section} />
        ))}
      </div>
    </div>
  )
}
