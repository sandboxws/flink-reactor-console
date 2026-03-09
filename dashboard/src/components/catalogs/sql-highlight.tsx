import type { HighlighterCore } from "@shikijs/core"
import { useEffect, useState } from "react"
import flinkrDark from "@/themes/flinkr-dark.json"

let highlighterPromise: Promise<HighlighterCore> | null = null

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
  code: string
  className?: string
}

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
