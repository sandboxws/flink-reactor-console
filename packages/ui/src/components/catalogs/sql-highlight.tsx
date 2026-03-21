"use client"

/**
 * Simple SQL code display component.
 * Renders SQL as monospace preformatted text with consistent styling.
 * For full syntax highlighting (e.g., Shiki), use the dashboard's version.
 */
interface SqlHighlightProps {
  code: string
  className?: string
}

export function SqlHighlight({ code, className }: SqlHighlightProps) {
  return (
    <pre className={className}>
      <code className="font-mono text-xs text-zinc-300">{code}</code>
    </pre>
  )
}
