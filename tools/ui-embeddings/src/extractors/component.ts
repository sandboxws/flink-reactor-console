import { readFileSync } from "node:fs"
import { basename, relative } from "node:path"
import type { ContentChunk } from "../types.js"

const _UI_PKG_ROOT = "packages/ui"

/**
 * Extract semantic chunks from a single .tsx/.ts component file.
 *
 * Strategy: rather than AST parsing, we use targeted regex extraction.
 * The UI package follows consistent patterns:
 *   - JSDoc comment immediately before `export function ComponentName`
 *   - `interface FooProps { ... }` blocks
 *   - `const variantStyles: Record<...> = { ... }` or similar config objects
 */
export function extractComponentChunks(
  absolutePath: string,
  repoRoot: string,
): ContentChunk[] {
  const content = readFileSync(absolutePath, "utf-8")
  const relPath = relative(repoRoot, absolutePath)
  const fileName = basename(absolutePath, ".tsx").replace(/\.ts$/, "")
  const chunks: ContentChunk[] = []

  // ── 1. Extract exported interfaces ────────────────────────────────────
  const interfaceRe =
    /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+interface\s+(\w+)\s*(?:extends\s+[^{]+)?\{[\s\S]*?\n\}/g
  let match: RegExpExecArray | null

  while ((match = interfaceRe.exec(content)) !== null) {
    const interfaceName = match[1]
    const block = match[0]
    chunks.push({
      id: `${fileName}-${interfaceName}`.toLowerCase(),
      type: "props-interface",
      content: block,
      path: relPath,
      component: inferComponentName(interfaceName),
      metadata: { interfaceName },
    })
  }

  // ── 2. Extract exported type aliases ──────────────────────────────────
  const typeAliasRe =
    /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+type\s+(\w+)\s*=\s*[\s\S]*?;/g
  while ((match = typeAliasRe.exec(content)) !== null) {
    const typeName = match[1]
    const block = match[0]
    // Skip single-line re-exports that are just type wrappers
    if (block.split("\n").length <= 2 && !block.includes("|")) continue
    chunks.push({
      id: `${fileName}-type-${typeName}`.toLowerCase(),
      type: "props-interface",
      content: block,
      path: relPath,
      component: inferComponentName(typeName),
      metadata: { typeName },
    })
  }

  // ── 3. Extract JSDoc + function signature as component summary ────────
  const jsdocFnRe =
    /(\/\*\*[\s\S]*?\*\/)\s*export\s+function\s+(\w+)\s*\([\s\S]*?\)\s*\{/g
  while ((match = jsdocFnRe.exec(content)) !== null) {
    const jsdoc = match[1]
    const fnName = match[2]
    chunks.push({
      id: `${fileName}-${fnName}-summary`.toLowerCase(),
      type: "component-summary",
      content: `${jsdoc}\nfunction ${fnName}`,
      path: relPath,
      component: fnName,
      metadata: { hasJSDoc: true },
    })
  }

  // Also capture functions WITHOUT JSDoc (common in Radix wrappers)
  const plainFnRe =
    /(?<!\/\*\*[\s\S]*?\*\/\s*)export\s+function\s+(\w+)\s*\(([^)]*)\)/g
  const jsdocFns = new Set<string>()
  const jsdocFnRe2 = /\/\*\*[\s\S]*?\*\/\s*export\s+function\s+(\w+)/g
  while ((match = jsdocFnRe2.exec(content)) !== null) {
    jsdocFns.add(match[1])
  }
  while ((match = plainFnRe.exec(content)) !== null) {
    const fnName = match[1]
    if (jsdocFns.has(fnName)) continue // Already captured with JSDoc
    const params = match[2].trim()
    // Build a summary from the function name and its params
    const propsType = params.match(/:\s*(\w+Props)/)?.[1] ?? ""
    chunks.push({
      id: `${fileName}-${fnName}-summary`.toLowerCase(),
      type: "component-summary",
      content: `function ${fnName}(${propsType ? `props: ${propsType}` : params.slice(0, 100)})\nExported from ${relPath}`,
      path: relPath,
      component: fnName,
      metadata: { hasJSDoc: false },
    })
  }

  // ── 4. Extract variant/style configuration objects ────────────────────
  const configRe =
    /const\s+(\w+(?:Styles?|Variants?|Config))\s*(?::\s*[^=]+)?\s*=\s*\{[\s\S]*?\n\};/g
  while ((match = configRe.exec(content)) !== null) {
    const configName = match[1]
    const block = match[0]
    chunks.push({
      id: `${fileName}-${configName}`.toLowerCase(),
      type: "variant-config",
      content: block,
      path: relPath,
      component: inferComponentFromFileName(fileName),
      metadata: { configName },
    })
  }

  // ── 5. Extract exported constants ─────────────────────────────────────
  const constRe =
    /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*[\s\S]*?;/g
  while ((match = constRe.exec(content)) !== null) {
    const constName = match[1]
    const block = match[0]
    // Skip tiny re-exports
    if (block.length < 30) continue
    chunks.push({
      id: `${fileName}-const-${constName}`.toLowerCase(),
      type: "constant",
      content: block,
      path: relPath,
      component: undefined,
      metadata: { constName },
    })
  }

  return deduplicateChunks(chunks)
}

/** Infer component name from a type name like "ButtonProps" → "Button" */
function inferComponentName(typeName: string): string | undefined {
  const match = typeName.match(/^(\w+?)(?:Props|Variant|Size|Config)$/)
  return match?.[1]
}

/** Infer component name from file name: "metric-card" → "MetricCard" */
function inferComponentFromFileName(fileName: string): string {
  return fileName
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("")
}

/** Remove duplicate chunk IDs, keeping the first occurrence. */
function deduplicateChunks(chunks: ContentChunk[]): ContentChunk[] {
  const seen = new Set<string>()
  return chunks.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}
