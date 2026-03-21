import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete"
import { syntaxTree } from "@codemirror/language"
import {
  type ComponentEntry,
  components,
  fieldMethods,
  getComponent,
  getSubComponents,
  type PropEntry,
  subComponents,
} from "./dsl-completions.generated"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lezer syntax tree node type (avoids direct @lezer/common dependency) */
type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>

/** Walk up the tree to find the nearest ancestor matching one of the given types. */
function findAncestor(node: SyntaxNode, ...types: string[]): SyntaxNode | null {
  let cur: SyntaxNode | null = node.parent
  while (cur) {
    if (types.includes(cur.name)) return cur
    cur = cur.parent
  }
  return null
}

/** Extract the tag name from a JSXOpenTag or JSXSelfClosingTag node. */
function getTagName(tagNode: SyntaxNode, doc: string): string | null {
  // Tag name is in JSXIdentifier or JSXMemberExpression child
  const ident = tagNode.getChild("JSXIdentifier")
  if (ident) return doc.slice(ident.from, ident.to)

  const member = tagNode.getChild("JSXMemberExpression")
  if (member) return doc.slice(member.from, member.to)

  return null
}

/** Get existing attribute names on a tag, to avoid re-suggesting them. */
function getExistingAttributes(tagNode: SyntaxNode, doc: string): Set<string> {
  const attrs = new Set<string>()
  for (let child = tagNode.firstChild; child; child = child.nextSibling) {
    if (child.name === "JSXAttribute") {
      const nameNode = child.getChild("JSXIdentifier")
      if (nameNode) {
        attrs.add(doc.slice(nameNode.from, nameNode.to))
      }
    }
  }
  return attrs
}

/** Convert a ComponentEntry category to a CM6 completion type label. */
function categoryToType(category: ComponentEntry["category"]): string {
  switch (category) {
    case "source":
      return "class"
    case "sink":
      return "class"
    case "transform":
      return "function"
    case "join":
      return "function"
    case "window":
      return "function"
    case "container":
      return "class"
    case "catalog":
      return "class"
    case "utility":
      return "function"
  }
}

// ---------------------------------------------------------------------------
// Completion builders
// ---------------------------------------------------------------------------

function buildComponentCompletions(prefix: string): Completion[] {
  const results: Completion[] = []

  for (const comp of components) {
    if (prefix && !comp.name.toLowerCase().startsWith(prefix.toLowerCase()))
      continue
    results.push({
      label: comp.name,
      type: categoryToType(comp.category),
      detail: comp.category,
      info: comp.description,
      boost:
        comp.category === "source" || comp.category === "container" ? 2 : 0,
    })
  }

  return results
}

function buildSubComponentCompletions(parent: string): Completion[] {
  const subs = getSubComponents(parent)
  return subs.map((sc) => ({
    label: sc.name,
    type: "function",
    detail: `${sc.parent}.${sc.name}`,
    info: sc.description,
  }))
}

function buildPropCompletions(
  componentName: string,
  existingAttrs: Set<string>,
): Completion[] {
  // Try direct component first
  let props: readonly PropEntry[] = []

  const comp = getComponent(componentName)
  if (comp) {
    props = comp.props
  } else {
    // Check if it's a sub-component (e.g. "Query.Select")
    const dotIdx = componentName.indexOf(".")
    if (dotIdx > -1) {
      const parent = componentName.slice(0, dotIdx)
      const child = componentName.slice(dotIdx + 1)
      const subs = getSubComponents(parent)
      const sub = subs.find((s) => s.name === child)
      if (sub) props = sub.props
    }
  }

  return props
    .filter((p) => !existingAttrs.has(p.name))
    .map((p) => ({
      label: p.name,
      type: "property",
      detail: p.type,
      info: p.description,
      boost: p.required ? 5 : 0,
      apply: p.type === "boolean" ? p.name : undefined,
    }))
}

function buildPropValueCompletions(
  componentName: string,
  propName: string,
): Completion[] {
  let props: readonly PropEntry[] = []

  const comp = getComponent(componentName)
  if (comp) {
    props = comp.props
  } else {
    const dotIdx = componentName.indexOf(".")
    if (dotIdx > -1) {
      const parent = componentName.slice(0, dotIdx)
      const child = componentName.slice(dotIdx + 1)
      const subs = getSubComponents(parent)
      const sub = subs.find((s) => s.name === child)
      if (sub) props = sub.props
    }
  }

  const prop = props.find((p) => p.name === propName)
  if (!prop?.enumValues) return []

  return prop.enumValues.map((v) => ({
    label: v,
    type: "enum",
    info: `${propName}: "${v}"`,
  }))
}

function buildFieldMethodCompletions(): Completion[] {
  return fieldMethods.map((m) => ({
    label: m.name,
    type: "method",
    detail: m.signature,
    info: m.description,
    apply: m.signature.replace("Field.", ""),
  }))
}

// ---------------------------------------------------------------------------
// Context detection
// ---------------------------------------------------------------------------

type CompletionKind =
  | { type: "tag"; prefix: string; from: number }
  | { type: "subComponent"; parent: string; from: number }
  | {
      type: "prop"
      componentName: string
      existingAttrs: Set<string>
      from: number
    }
  | { type: "propValue"; componentName: string; propName: string; from: number }
  | { type: "fieldMethod"; from: number }
  | null

/**
 * Find the enclosing JSXOpenTag or JSXSelfClosingTag.
 * Checks the node itself AND its ancestors (Lezer's resolveInner
 * sometimes returns the tag node directly, not a child of it).
 */
function findTagNode(node: SyntaxNode): SyntaxNode | null {
  let cur: SyntaxNode | null = node
  while (cur) {
    if (cur.name === "JSXOpenTag" || cur.name === "JSXSelfClosingTag")
      return cur
    cur = cur.parent
  }
  return null
}

/**
 * Text-based fallback to detect prop context when the Lezer tree
 * doesn't provide enough structure (incomplete JSX, error nodes, etc.)
 *
 * Scans backward from the cursor to find `<ComponentName ... |` patterns.
 */
function detectPropContextFromText(
  doc: string,
  pos: number,
): { componentName: string; existingAttrs: Set<string> } | null {
  // Scan backward to find the opening `<TagName`
  // We limit the scan to 2000 chars to avoid perf issues
  const scanStart = Math.max(0, pos - 2000)
  const before = doc.slice(scanStart, pos)

  // Find the last unmatched `<` that starts a tag name (uppercase = component)
  let depth = 0
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i]
    if (ch === ">" && before[i - 1] !== "=") depth++
    if (ch === "<") {
      if (depth > 0) {
        depth--
        continue
      }
      // Found an unmatched `<` — check if followed by uppercase tag name
      const rest = before.slice(i + 1)
      const tagMatch = rest.match(/^([A-Z]\w*(?:\.\w+)?)/)
      if (tagMatch) {
        const componentName = tagMatch[1]
        // Collect existing attribute names from the text between tag and cursor
        const attrRegion = rest.slice(tagMatch[0].length)
        const existingAttrs = new Set<string>()
        const attrPattern = /\b([a-z]\w*)\s*=/gi
        let m: RegExpExecArray | null = null
        while ((m = attrPattern.exec(attrRegion)) !== null) {
          existingAttrs.add(m[1])
        }
        return { componentName, existingAttrs }
      }
      return null
    }
  }
  return null
}

/**
 * Text-based fallback to detect prop value context.
 * Matches patterns like: `propName="partial|` or `propName="|`
 */
function detectPropValueFromText(
  doc: string,
  pos: number,
): { componentName: string; propName: string; from: number } | null {
  const scanStart = Math.max(0, pos - 2000)
  const before = doc.slice(scanStart, pos)

  // Check if we're inside an open string attribute value: propName="...|
  const valueMatch = before.match(/(\w+)=["']([^"']*)$/)
  if (!valueMatch) return null

  const propName = valueMatch[1]
  const valueTyped = valueMatch[2]
  const from = pos - valueTyped.length

  // Now find the component name
  const propCtx = detectPropContextFromText(doc, pos)
  if (!propCtx) return null

  return { componentName: propCtx.componentName, propName, from }
}

function detectContext(ctx: CompletionContext): CompletionKind {
  const { state, pos } = ctx
  const doc = state.doc.toString()
  const tree = syntaxTree(state)
  const nodeBefore = tree.resolveInner(pos, -1)

  // --- Field. completions ---
  const lineStart = state.doc.lineAt(pos).from
  const lineBefore = doc.slice(lineStart, pos)
  const fieldMatch = lineBefore.match(/Field\.(\w*)$/)
  if (fieldMatch) {
    return { type: "fieldMethod", from: pos - fieldMatch[1].length }
  }

  // --- JSX tag completions ---
  if (nodeBefore.name === "JSXStartTag" || nodeBefore.name === "<") {
    return { type: "tag", prefix: "", from: pos }
  }

  // Typing a tag name: `<Kafka|`
  if (nodeBefore.name === "JSXIdentifier") {
    const parent = nodeBefore.parent
    if (parent?.name === "JSXOpenTag" || parent?.name === "JSXSelfClosingTag") {
      const startTag = parent.getChild("JSXStartTag")
      if (startTag && nodeBefore.from === startTag.to) {
        const prefix = doc.slice(nodeBefore.from, pos)
        return { type: "tag", prefix, from: nodeBefore.from }
      }
    }

    // JSXMemberExpression like `Query.Select|`
    if (parent?.name === "JSXMemberExpression") {
      const grandParent = parent.parent
      if (
        grandParent?.name === "JSXOpenTag" ||
        grandParent?.name === "JSXSelfClosingTag"
      ) {
        const firstIdent = parent.getChild("JSXIdentifier")
        if (firstIdent && firstIdent !== nodeBefore) {
          const parentName = doc.slice(firstIdent.from, firstIdent.to)
          return {
            type: "subComponent",
            parent: parentName,
            from: nodeBefore.from,
          }
        }
      }
    }
  }

  // After a `.` in JSXMemberExpression: `<Query.|`
  if (nodeBefore.name === ".") {
    const parent = nodeBefore.parent
    if (parent?.name === "JSXMemberExpression") {
      const grandParent = parent.parent
      if (
        grandParent?.name === "JSXOpenTag" ||
        grandParent?.name === "JSXSelfClosingTag"
      ) {
        const firstIdent = parent.getChild("JSXIdentifier")
        if (firstIdent) {
          const parentName = doc.slice(firstIdent.from, firstIdent.to)
          return { type: "subComponent", parent: parentName, from: pos }
        }
      }
    }
  }

  // --- Prop & prop value completions ---
  const tagNode = findTagNode(nodeBefore)
  if (tagNode) {
    const componentName = getTagName(tagNode, doc)
    if (!componentName) return null

    // Check if we're typing inside an attribute value (strictly inside quotes)
    const attrNode = findAncestor(nodeBefore, "JSXAttribute")
    if (attrNode) {
      const valueNode = attrNode.getChild("JSXAttributeValue")
      // Use strict < for `to` — position AT `to` means we're past the closing quote
      if (valueNode && pos > valueNode.from && pos < valueNode.to) {
        const propNameNode = attrNode.getChild("JSXIdentifier")
        if (propNameNode) {
          const propName = doc.slice(propNameNode.from, propNameNode.to)
          const valueText = doc.slice(valueNode.from, valueNode.to)
          if (valueText.startsWith('"') || valueText.startsWith("'")) {
            return {
              type: "propValue",
              componentName,
              propName,
              from: valueNode.from + 1,
            }
          }
        }
      }

      // Typing an attribute name: nodeBefore is JSXIdentifier inside JSXAttribute
      if (
        nodeBefore.name === "JSXIdentifier" &&
        nodeBefore.parent === attrNode
      ) {
        // Make sure this isn't the tag name itself
        const startTag = tagNode.getChild("JSXStartTag")
        if (!startTag || nodeBefore.from !== startTag.to) {
          const existingAttrs = getExistingAttributes(tagNode, doc)
          return {
            type: "prop",
            componentName,
            existingAttrs,
            from: nodeBefore.from,
          }
        }
      }
    }

    // Cursor is inside the tag but not in an attribute — offer props
    // This handles: after tag name + space, after completed attr, error nodes, etc.
    const nameNode =
      tagNode.getChild("JSXIdentifier") ??
      tagNode.getChild("JSXMemberExpression")
    if (nameNode && pos > nameNode.to) {
      const existingAttrs = getExistingAttributes(tagNode, doc)
      // Check if we're typing a partial word (for filtering)
      const wordMatch = lineBefore.match(/(\w+)$/)
      const from = wordMatch ? pos - wordMatch[1].length : pos
      return { type: "prop", componentName, existingAttrs, from }
    }
  }

  // --- Text-based fallbacks for incomplete/error parse states ---
  // Prop value inside an unclosed string: `format="j|`
  const valueCtx = detectPropValueFromText(doc, pos)
  if (valueCtx) {
    return { type: "propValue", ...valueCtx }
  }

  // Prop name inside a tag that the parser couldn't fully structure
  const propCtx = detectPropContextFromText(doc, pos)
  if (propCtx) {
    const wordMatch = lineBefore.match(/(\w+)$/)
    const from = wordMatch ? pos - wordMatch[1].length : pos
    return { type: "prop", ...propCtx, from }
  }

  return null
}

// ---------------------------------------------------------------------------
// CompletionSource
// ---------------------------------------------------------------------------

export function dslCompletionSource(
  ctx: CompletionContext,
): CompletionResult | null {
  const kind = detectContext(ctx)
  if (!kind) {
    // Fallback for explicit activation (Ctrl+Space): try tag completions
    if (!ctx.explicit) return null

    const doc = ctx.state.doc.toString()
    const lineStart = ctx.state.doc.lineAt(ctx.pos).from
    const lineBefore = doc.slice(lineStart, ctx.pos)

    const tagMatch = lineBefore.match(/<(\w*)$/)
    if (tagMatch) {
      const options = buildComponentCompletions(tagMatch[1])
      if (options.length === 0) return null
      return { from: ctx.pos - tagMatch[1].length, options }
    }

    return null
  }

  let options: Completion[] = []

  switch (kind.type) {
    case "tag":
      options = buildComponentCompletions(kind.prefix)
      break
    case "subComponent":
      options = buildSubComponentCompletions(kind.parent)
      break
    case "prop":
      options = buildPropCompletions(kind.componentName, kind.existingAttrs)
      break
    case "propValue":
      options = buildPropValueCompletions(kind.componentName, kind.propName)
      break
    case "fieldMethod":
      options = buildFieldMethodCompletions()
      break
  }

  if (options.length === 0) return null

  return {
    from: kind.from,
    options,
    validFor: /^\w*$/,
  }
}
