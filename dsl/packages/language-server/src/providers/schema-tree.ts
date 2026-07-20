// `flinkReactor/schemaTree` assembler (schema-navigation, Tier-2).
//
// Projects the held synthesis state into the Schema Explorer's tree: the
// pipeline's sources and sinks, each with fields/PK/watermark from the worker-
// decoded `tableSchemas`, paired with source positions resolved host-side — the
// node's JSX range from the source-position map, and each source field's
// `Schema()` key range via the same cross-file resolution `textDocument/
// definition` uses. Pure: reads `state` only, never re-synthesizes.

import { fileURLToPath } from "node:url"
import type { DocumentSynthState } from "../document-state.js"
import type {
  SchemaTableInfo,
  SchemaTreeField,
  SchemaTreeResponse,
} from "../preview/schema-tree-model.js"
import { findProjectRoot, parseSource } from "./definition/binding.js"
import {
  resolveSourceSchemaFields,
  type SchemaFieldLocations,
} from "./definition/index.js"

/**
 * Build the schema-tree model for a document's held synthesis state. A failed
 * synthesis yields an `ok: false` envelope carrying the error (the tree keeps
 * last-good tables) rather than throwing.
 */
export function buildSchemaTreeModel(
  state: DocumentSynthState,
  sourceText: string,
): SchemaTreeResponse {
  const { uri, version, result, positionMap } = state
  if (!result.ok) {
    return {
      uri,
      version,
      ok: false,
      error: result.loadError?.message ?? "Synthesis failed.",
      tables: [],
    }
  }

  const filePath = uriToPath(uri)
  const sf = filePath ? parseSource(sourceText, filePath) : undefined
  const projectDir = filePath ? findProjectRoot(filePath) : undefined

  const tables: SchemaTableInfo[] = result.tableSchemas.map((t) => {
    const nodeRange = positionMap.map.get(t.nodeId)
    const locationRef = nodeRange ? { uri, range: nodeRange } : undefined

    // Resolve each source field's `Schema()` key position once (sinks write an
    // inferred input schema with no field-key declaration to reveal).
    let fieldLocs: SchemaFieldLocations | undefined
    if (t.role === "source" && nodeRange && sf && filePath && projectDir) {
      fieldLocs = resolveSourceSchemaFields({
        sf,
        filePath,
        projectDir,
        sourceRange: nodeRange,
      })
    }

    const fields: SchemaTreeField[] = t.fields.map((f) => {
      const range = fieldLocs?.fields.get(f.name)
      return {
        name: f.name,
        type: f.type,
        primaryKey: f.primaryKey,
        locationRef:
          range && fieldLocs ? { uri: fieldLocs.uri, range } : undefined,
      }
    })

    return {
      nodeId: t.nodeId,
      role: t.role,
      component: t.component,
      label: t.label,
      fields,
      watermark: t.watermark,
      locationRef,
    }
  })

  return { uri, version, ok: true, tables }
}

function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}
