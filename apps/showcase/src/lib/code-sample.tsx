export function ImportSnippet({ code }: { code: string }) {
  return (
    <pre className="mt-2 rounded-lg bg-black/30 p-3 text-xs font-mono text-fg-secondary overflow-x-auto">
      <code>{code}</code>
    </pre>
  )
}
