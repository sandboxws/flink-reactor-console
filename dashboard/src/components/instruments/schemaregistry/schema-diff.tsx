import type { SchemaDetail } from "@/lib/instruments/types"
import { computeLineDiff, formatSchema } from "./lib"

export function SchemaDiff({
  before,
  after,
}: {
  before: SchemaDetail
  after: SchemaDetail
}) {
  const a = formatSchema(before.schema, before.schemaType)
  const b = formatSchema(after.schema, after.schemaType)
  const diff = computeLineDiff(a, b)

  return (
    <div className="glass-card overflow-hidden">
      <div className="grid grid-cols-2 border-b border-dash-border text-xs text-zinc-500">
        <div className="px-3 py-2">v{before.version}</div>
        <div className="border-l border-dash-border px-3 py-2">
          v{after.version}
        </div>
      </div>
      <div className="grid grid-cols-2 font-mono text-xs leading-relaxed">
        <div>
          {diff.map((d, idx) => (
            <DiffCell
              // eslint-disable-next-line react/no-array-index-key
              key={`l-${idx}`}
              line={d.left}
              op={d.op === "del" ? "del" : d.op === "ctx" ? "ctx" : "empty"}
            />
          ))}
        </div>
        <div className="border-l border-dash-border">
          {diff.map((d, idx) => (
            <DiffCell
              // eslint-disable-next-line react/no-array-index-key
              key={`r-${idx}`}
              line={d.right}
              op={d.op === "add" ? "add" : d.op === "ctx" ? "ctx" : "empty"}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DiffCell({
  line,
  op,
}: {
  line: string | null
  op: "add" | "del" | "ctx" | "empty"
}) {
  const bg =
    op === "add"
      ? "bg-fr-emerald/10 text-fr-emerald"
      : op === "del"
        ? "bg-job-failed/10 text-job-failed"
        : op === "empty"
          ? "bg-white/[0.02]"
          : "text-zinc-300"
  const marker =
    op === "add" ? "+" : op === "del" ? "-" : op === "empty" ? " " : " "
  return (
    <div className={`flex gap-2 px-3 py-0.5 ${bg}`}>
      <span className="w-3 select-none text-zinc-500">{marker}</span>
      <span className="break-all">{line ?? " "}</span>
    </div>
  )
}
