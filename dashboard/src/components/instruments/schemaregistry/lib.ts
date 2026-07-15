import type { SchemaType } from "@/lib/instruments/types"

export const SCHEMA_TYPE_BADGE: Record<SchemaType, string> = {
  AVRO: "bg-fr-coral/15 text-fr-coral",
  PROTOBUF: "bg-fr-blue/15 text-fr-blue",
  JSON: "bg-fr-amber/15 text-fr-amber",
}

export function formatSchema(schema: string, schemaType: SchemaType): string {
  if (schemaType === "PROTOBUF") return schema
  // AVRO and JSON Schema are JSON; pretty-print if parseable.
  try {
    return JSON.stringify(JSON.parse(schema), null, 2)
  } catch {
    return schema
  }
}

export type DiffOp = "ctx" | "add" | "del"
export type DiffLine = { left: string | null; right: string | null; op: DiffOp }

// computeLineDiff returns a side-by-side line diff using the standard
// LCS-based approach. Suitable for short schema texts (< a few hundred lines).
export function computeLineDiff(a: string, b: string): DiffLine[] {
  const al = a.split("\n")
  const bl = b.split("\n")
  const m = al.length
  const n = bl.length

  // dp[i][j] = LCS length of al[0..i) and bl[0..j)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  )
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      dp[i + 1][j + 1] =
        al[i] === bl[j] ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (al[i - 1] === bl[j - 1]) {
      out.unshift({ left: al[i - 1], right: bl[j - 1], op: "ctx" })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.unshift({ left: al[i - 1], right: null, op: "del" })
      i--
    } else {
      out.unshift({ left: null, right: bl[j - 1], op: "add" })
      j--
    }
  }
  while (i > 0) {
    out.unshift({ left: al[--i], right: null, op: "del" })
  }
  while (j > 0) {
    out.unshift({ left: null, right: bl[--j], op: "add" })
  }
  return out
}
