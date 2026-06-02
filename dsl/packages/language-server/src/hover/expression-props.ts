// Reuse the DSL's single source of truth for which component props carry SQL
// expressions, so hover's column-reference classification stays in lockstep
// with `validateExpressionSyntax`. A new expression prop added to the DSL is
// honored here automatically.

import { EXPRESSION_PROPS } from "@flink-reactor/dsl/browser"

/**
 * Is `propName` on component `tag` a SQL-expression-valued prop — i.e. may an
 * identifier inside its string value be a column reference?
 *
 * Handles both forms the DSL declares:
 *   - scalar expression props: `Filter.condition`, `Join.on`, `Qualify.condition`,
 *     `Query.Where`/`Query.Having` `condition`
 *   - object-of-expressions props: `Map.select` (declared `select.*`),
 *     `Validate.rules` (`rules.*`) — the cursor sits inside one of the object's
 *     string values, so the base prop name is what we match.
 *
 * `tag` is the JSX tag text, including dot-notation (`Query.Where`), which is
 * exactly how `EXPRESSION_PROPS` is keyed.
 */
export function isExpressionProp(tag: string, propName: string): boolean {
  const paths = EXPRESSION_PROPS[tag]
  if (!paths) return false
  return paths.some((path) => path === propName || path === `${propName}.*`)
}

/** Every component tag that declares at least one SQL-expression prop. */
export function hasExpressionProps(tag: string): boolean {
  return EXPRESSION_PROPS[tag] !== undefined
}
