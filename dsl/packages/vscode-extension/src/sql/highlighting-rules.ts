// Pure logic for the embedded-SQL highlighting opt-out (no `vscode` import, so
// it is unit-testable — see vitest.config's "pure logic only" note). The
// TextMate grammar tags every SQL token it colors with a trailing FR-only marker
// scope (`meta.embedded.flinkreactor-sql`); when `flinkReactor.sql.highlighting`
// excludes the TextMate layer (`semantic`/`off`), the extension neutralizes that
// marker via `editor.tokenColorCustomizations` so FlinkReactor's grammar
// coloring is suppressed *without* touching standalone `.sql` files (which carry
// the standard scopes but not the marker). This module decides the rule set; the
// controller (`highlighting-controller.ts`) reads/writes the live config.
//
// Note (platform limitation): VS Code cannot un-register a contributed grammar at
// runtime, so the TextMate layer is neutralized by color rather than removed. The
// neutralization target is the default-theme string-literal color, so suppressed
// SQL renders like the ordinary string literal around it. The semantic layer's
// opt-out is exact (the server emits no SQL tokens for `textmate`/`off`).

/** The FR-only marker scope every grammar SQL token carries (rightmost, most-
 *  specific scope), the precise neutralization handle. */
export const FR_SQL_MARKER_SCOPE = "meta.embedded.flinkreactor-sql"

export type SqlHighlightingMode =
  | "semantic+textmate"
  | "textmate"
  | "semantic"
  | "off"

/** One `editor.tokenColorCustomizations.textMateRules` entry. */
export interface TextMateRule {
  readonly scope?: string | readonly string[]
  readonly settings: {
    readonly foreground?: string
    readonly fontStyle?: string
  }
}

/** True when `mode` keeps the TextMate grammar layer coloring active. */
export function textMateLayerActive(mode: string): boolean {
  return mode === "semantic+textmate" || mode === "textmate"
}

/** The default-theme string-literal foreground for the theme brightness — the
 *  neutralization target so suppressed FR SQL renders like an ordinary string. */
export function stringColorFor(isLight: boolean): string {
  return isLight ? "#a31515" : "#ce9178"
}

/**
 * Compute the next `textMateRules` for `mode`: drop any prior FR neutralization
 * rule, then re-add it (targeting the marker scope) when the grammar layer is
 * off. Non-FR rules are preserved in order, so a user's own customizations are
 * never clobbered. Returns `null` when the result equals `existing` — the
 * caller then skips the config write, avoiding churn (notably: the default
 * `semantic+textmate` mode adds nothing, so a fresh install writes no config).
 */
export function nextTextMateRules(
  existing: readonly TextMateRule[],
  mode: string,
  isLight: boolean,
): TextMateRule[] | null {
  const others = existing.filter((rule) => rule.scope !== FR_SQL_MARKER_SCOPE)
  const next = textMateLayerActive(mode)
    ? others
    : [
        ...others,
        {
          scope: FR_SQL_MARKER_SCOPE,
          settings: { foreground: stringColorFor(isLight) },
        },
      ]
  return sameRules(existing, next) ? null : next
}

function sameRules(
  a: readonly TextMateRule[],
  b: readonly TextMateRule[],
): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}
