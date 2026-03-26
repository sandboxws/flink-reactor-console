/**
 * @module stack-trace
 *
 * Java exception stack trace renderer with syntax-aware formatting.
 * Parses raw stack trace text into structured sections (header, frames,
 * caused-by chains) and renders them with visual differentiation between
 * application frames (highlighted) and framework frames (dimmed).
 * Caused-by sections are collapsible to reduce visual noise.
 */

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@flink-reactor/ui"
import { Check, ChevronRight, Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/cn"

/** Package prefixes considered "framework" code, rendered with dimmed styling. */
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

/** Checks whether a stack frame line belongs to a known framework package. */
function isFrameworkFrame(frame: string): boolean {
  const match = frame.match(/^\s+at\s+([\w.$]+)/)
  if (!match) return false
  return FRAMEWORK_PREFIXES.some((prefix) => match[1].startsWith(prefix))
}

/** A single stack frame line with framework classification. */
interface StackFrame {
  /** The raw "at com.example.Class.method(File.java:42)" text. */
  text: string
  /** Whether this frame belongs to a framework package (dimmed in UI). */
  isFramework: boolean
}

/** Represents a "... N more" elision marker in a Java stack trace. */
interface ElidedFrames {
  /** Number of elided frames. */
  count: number
  /** The original "... N more" text. */
  text: string
}

/** Discriminated union for items in a stack trace frame list. */
type FrameItem =
  | { type: "frame"; frame: StackFrame }
  | { type: "elided"; elided: ElidedFrames }

/** A "Caused by:" section containing its own header and frame list. */
interface CausedBySection {
  /** The "Caused by: ExceptionClass: message" header line. */
  header: string
  /** Stack frames belonging to this caused-by section. */
  frames: FrameItem[]
}

/** Fully parsed Java stack trace with root frames and chained causes. */
interface ParsedTrace {
  /** The top-level exception line (e.g. "java.lang.RuntimeException: msg"). */
  header: string
  /** Stack frames from the root exception. */
  frames: FrameItem[]
  /** Chained "Caused by:" sections in order. */
  causedBy: CausedBySection[]
}

/**
 * Parses a raw Java stack trace string into structured sections.
 *
 * Splits the trace into a header line, root frames, and zero or more
 * "Caused by:" chains. Each frame is classified as framework or
 * application code, and "... N more" elision markers are preserved.
 */
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

/** Renders a list of stack frames with visual distinction between application and framework code. */
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

/** Collapsible "Caused by:" section showing the chained exception and its frames. */
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

/**
 * Java exception stack trace renderer with syntax-aware formatting.
 *
 * Parses the raw trace text into structured sections, highlights application
 * frames over framework frames, and renders "Caused by:" chains as collapsible
 * sections to reduce visual noise. Includes a hover-visible copy button for
 * copying the full raw trace to the clipboard.
 */
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
