// Node-kind → fill color, the single canonical FlinkReactor palette.
//
// These hex values MUST match the CLI `fr graph` `kindColors` map in the DSL
// repo at `src/cli/commands/graph.ts`, so the editor visualization, the CLI
// DOT/SVG output, and any console rendering agree on "what color is a Sink".
// The webview cannot import the CLI (separate package, Node-only), so the
// table is duplicated here and pinned by `__tests__/palette.test.ts`.

export const KIND_COLORS: Readonly<Record<string, string>> = {
  Source: "#4CAF50",
  Transform: "#2196F3",
  Join: "#FF9800",
  Window: "#9C27B0",
  Sink: "#F44336",
  Catalog: "#795548",
  RawSQL: "#607D8B",
  UDF: "#009688",
  CEP: "#E91E63",
  Pipeline: "#9E9E9E",
}

/** The fallback color for any kind not in the palette. */
export const DEFAULT_KIND_COLOR = "#9E9E9E"

/** Resolve a node kind to its fill color, defaulting unknown kinds. */
export function kindColor(kind: string): string {
  return KIND_COLORS[kind] ?? DEFAULT_KIND_COLOR
}
