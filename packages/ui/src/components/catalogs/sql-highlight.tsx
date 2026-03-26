/** SQL syntax highlighting component — renders SQL strings with keyword coloring. */
"use client"

interface SqlHighlightProps {
  code: string
  className?: string
}

/** Renders a SQL string as monospace preformatted text with consistent styling. */
export function SqlHighlight({ code, className }: SqlHighlightProps) {
  return (
    <pre className={className}>
      <code className="font-mono text-xs text-zinc-300">{code}</code>
    </pre>
  )
}
