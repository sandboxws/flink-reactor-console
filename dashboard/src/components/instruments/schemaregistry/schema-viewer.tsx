import type { SchemaDetail } from "../../types"
import { formatSchema, SCHEMA_TYPE_BADGE } from "./lib"

export function SchemaViewer({ detail }: { detail: SchemaDetail }) {
  const formatted = formatSchema(detail.schema, detail.schemaType)
  const badgeClass =
    SCHEMA_TYPE_BADGE[detail.schemaType] ?? "bg-white/[0.08] text-zinc-300"

  return (
    <div className="space-y-3">
      <div className="glass-card flex flex-wrap items-center gap-3 p-3">
        <span className="font-mono text-sm text-zinc-200">{detail.subject}</span>
        <span className="font-mono text-xs text-zinc-500">v{detail.version}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${badgeClass}`}
        >
          {detail.schemaType}
        </span>
        <span className="ml-auto text-xs text-zinc-500">id: {detail.id}</span>
      </div>

      {detail.references.length > 0 && (
        <div className="glass-card p-3 text-xs">
          <div className="mb-2 text-zinc-500">References</div>
          <ul className="space-y-1">
            {detail.references.map((ref) => (
              <li
                key={`${ref.subject}-${ref.version}-${ref.name}`}
                className="font-mono text-zinc-300"
              >
                <span className="text-zinc-500">{ref.name}</span> →{" "}
                {ref.subject} v{ref.version}
              </li>
            ))}
          </ul>
        </div>
      )}

      <pre className="glass-card max-h-[60vh] overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-zinc-200">
        {formatted}
      </pre>
    </div>
  )
}
