/**
 * @module sql-highlight
 *
 * Inline SQL syntax highlighting using Shiki. Lazy-loads the highlighter
 * core, SQL language grammar, and the FlinkReactor Night theme on first
 * render. Falls back to plain monospace text while loading.
 */

import type { HighlighterCore } from "@shikijs/core"
import { useEffect, useState } from "react"
import flinkrDark from "@/themes/flinkr-dark.json"

/** Cached promise — the highlighter is initialized only once across all instances. */
let highlighterPromise: Promise<HighlighterCore> | null = null

/** Lazily initializes and caches the Shiki highlighter with SQL support. */
function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import("@shikijs/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/langs/sql"),
    ] as const).then(([core, engine, sqlLang]) =>
      core.createHighlighterCore({
        engine: engine.createJavaScriptRegexEngine(),
        themes: [
          flinkrDark as unknown as Parameters<
            typeof core.createHighlighterCore
          >[0]["themes"][number],
        ],
        langs: [sqlLang.default],
      }),
    )
  }
  return highlighterPromise
}

interface SqlHighlightProps {
  /** The SQL source code to highlight. */
  code: string
  /** Optional CSS class applied to the outer container. */
  className?: string
}

/**
 * Renders syntax-highlighted SQL using Shiki's FlinkReactor Night theme.
 * Shows plain monospace text as a fallback while the highlighter loads.
 */
export function SqlHighlight({ code, className }: SqlHighlightProps) {
  const [html, setHtml] = useState("")

  useEffect(() => {
    let cancelled = false
    getHighlighter().then((highlighter) => {
      if (cancelled) return
      setHtml(
        highlighter.codeToHtml(code, {
          lang: "sql",
          theme: "FlinkReactor Night",
        }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [code])

  if (!html) {
    return (
      <pre className={className}>
        <code className="font-mono text-xs text-zinc-300">{code}</code>
      </pre>
    )
  }

  // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is trusted (no user input)
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  )
}
