// Greenfield generator (visual-designer, tasks 5.1–5.2): emit a fresh, fully
// static `.tsx` pipeline from a canvas description composed in the designer.
//
// Deterministic by construction — the same canvas always prints byte-identical
// output: imports in first-use order (the scaffolder-template style), literal
// props in canvas order, statically nested JSX, 2-space indentation, single-
// quoted imports + double-quoted JSX attributes (matching
// `src/cli/templates/*` pipelines). The emitted file carries the
// `// @flink-reactor designer` pragma — it is a static subset by construction,
// so structural editing keeps working on it. The generator NEVER reads a file
// back into a richer representation: generation is one-way, write-new-only.

import type { CanvasNode, GenerateEdit } from "./model.js"
import { DESIGNER_PRAGMA } from "./static-subset.js"

export function generatePipelineFile(edit: GenerateEdit): string {
  const components: string[] = []
  const schemaImports = new Map<string, Set<string>>() // path → identifiers
  collectImports(
    [
      {
        component: "Pipeline",
        props: { name: edit.pipelineName },
        children: edit.nodes,
      },
    ],
    components,
    schemaImports,
  )

  const lines: string[] = []
  lines.push(`// ${DESIGNER_PRAGMA}`)
  lines.push(`import { ${components.join(", ")} } from '@flink-reactor/dsl';`)
  for (const [path, names] of schemaImports) {
    lines.push(`import { ${[...names].join(", ")} } from '${path}';`)
  }
  lines.push("")
  lines.push("export default (")
  lines.push(
    printNode(
      {
        component: "Pipeline",
        props: { name: edit.pipelineName },
        children: edit.nodes,
      },
      "  ",
    ),
  )
  lines.push(");")
  return `${lines.join("\n")}\n`
}

/** First-use-order component + schema-import collection (deduplicated). */
function collectImports(
  nodes: readonly CanvasNode[],
  components: string[],
  schemaImports: Map<string, Set<string>>,
): void {
  for (const node of nodes) {
    // Dotted sub-components (`Route.Branch`) import their root (`Route`).
    const root = node.component.split(".")[0] ?? node.component
    if (!components.includes(root)) components.push(root)
    for (const ref of Object.values(node.identifierProps ?? {})) {
      const set = schemaImports.get(ref.importFrom) ?? new Set<string>()
      set.add(ref.identifier)
      schemaImports.set(ref.importFrom, set)
    }
    if (node.children) collectImports(node.children, components, schemaImports)
  }
}

function printNode(node: CanvasNode, indent: string): string {
  const attrs = printAttrs(node)
  const open = `${indent}<${node.component}${attrs}`
  const children = node.children ?? []
  if (children.length === 0) return `${open} />`
  const inner = children.map((c) => printNode(c, `${indent}  `)).join("\n")
  return `${open}>\n${inner}\n${indent}</${node.component}>`
}

function printAttrs(node: CanvasNode): string {
  const parts: string[] = []
  for (const [name, value] of Object.entries(node.props)) {
    parts.push(`${name}=${printValue(value)}`)
  }
  for (const [name, ref] of Object.entries(node.identifierProps ?? {})) {
    parts.push(`${name}={${ref.identifier}}`)
  }
  if (parts.length === 0) return ""
  // Single-attribute elements stay on one line; multi-attribute elements
  // could wrap, but a deterministic single-line form keeps the printer simple
  // and the output stable — Biome/the author can reflow without semantic
  // change, and regeneration is byte-identical either way.
  return ` ${parts.join(" ")}`
}

function printValue(
  value: string | number | boolean | readonly (string | number)[],
): string {
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" || typeof value === "boolean") {
    return `{${String(value)}}`
  }
  const items = value.map((v) =>
    typeof v === "string" ? JSON.stringify(v) : String(v),
  )
  return `{[${items.join(", ")}]}`
}
