/**
 * Read-only re-export of the canonical component hierarchy + inventory for
 * out-of-process consumers (notably `@flink-reactor/language-server`).
 *
 * The plugin stays the single source of truth for which components are valid
 * children of which parents; this surface lets the LSP reuse the SAME rules so
 * component validity never drifts between `tsserver` (the plugin) and the LSP.
 * Nothing here mutates plugin state — it is a pure data + AST-helper export.
 */
export {
  type ComponentKind,
  DSL_COMPONENTS,
  getComponentsByKind,
  getSubComponents,
  getTopLevelComponents,
  HIERARCHY_ONLY_COMPONENTS,
} from "./component-inventory"
export { COMPONENT_CHILDREN, createRulesRegistry } from "./component-rules"
export { getComponentName, getParentTagAtPosition } from "./context-detector"
export type { ComponentRulesRegistry } from "./types"
