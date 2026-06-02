import {
  applyEdits,
  type FormattingOptions,
  modify,
  type ParseError,
  parse as parseJsonc,
} from "jsonc-parser"

export const TS_PLUGIN_NAME = "@flink-reactor/ts-plugin"
export const JSX_IMPORT_SOURCE = "@flink-reactor/dsl"
export const JSX = "react-jsx"

export interface TsconfigEditResult {
  /** The tsconfig text after edits — identical to the input when already configured. */
  readonly newText: string
  /** Whether any edit was needed. */
  readonly changed: boolean
  /** True when the input could not be parsed as JSONC; `newText` is then the input. */
  readonly unparseable: boolean
}

const FORMAT: FormattingOptions = { insertSpaces: true, tabSize: 2, eol: "\n" }

interface CompilerOptions {
  plugins?: unknown[]
  jsxImportSource?: unknown
  jsx?: unknown
}

/**
 * Compute the tsconfig text that ensures `@flink-reactor/ts-plugin` is active:
 * the plugin entry is present in `compilerOptions.plugins`, `jsxImportSource` is
 * `@flink-reactor/dsl`, and `jsx` is `react-jsx`. Comment- and format-preserving
 * (via `jsonc-parser`), idempotent, and it NEVER touches `compilerOptions.paths`.
 *
 * Pure: takes and returns text, so the policy is unit-testable without `vscode`.
 * The caller turns the resulting text into an undoable `WorkspaceEdit`.
 */
export function computeTsconfigEdits(text: string): TsconfigEditResult {
  const errors: ParseError[] = []
  const root = parseJsonc(text, errors, { allowTrailingComma: true }) as
    | { compilerOptions?: CompilerOptions }
    | undefined

  // jsonc-parser recovers from syntax errors (returning a partial tree) rather
  // than throwing, so a malformed tsconfig surfaces as a non-empty `errors`
  // array, not `undefined`. Refuse to edit it — touching it could corrupt it.
  if (root === undefined || typeof root !== "object" || errors.length > 0) {
    return { newText: text, changed: false, unparseable: true }
  }

  const co: CompilerOptions = root.compilerOptions ?? {}
  const plugins = Array.isArray(co.plugins) ? co.plugins : []
  const hasPlugin = plugins.some(
    (p) =>
      p !== null &&
      typeof p === "object" &&
      (p as { name?: unknown }).name === TS_PLUGIN_NAME,
  )

  let next = text

  if (!hasPlugin) {
    next =
      plugins.length === 0
        ? applyEdits(
            next,
            modify(
              next,
              ["compilerOptions", "plugins"],
              [{ name: TS_PLUGIN_NAME }],
              {
                formattingOptions: FORMAT,
              },
            ),
          )
        : // Append after existing entries so their formatting/comments survive.
          applyEdits(
            next,
            modify(
              next,
              ["compilerOptions", "plugins", plugins.length],
              { name: TS_PLUGIN_NAME },
              { formattingOptions: FORMAT, isArrayInsertion: true },
            ),
          )
  }

  if (co.jsxImportSource !== JSX_IMPORT_SOURCE) {
    next = applyEdits(
      next,
      modify(next, ["compilerOptions", "jsxImportSource"], JSX_IMPORT_SOURCE, {
        formattingOptions: FORMAT,
      }),
    )
  }

  if (co.jsx !== JSX) {
    next = applyEdits(
      next,
      modify(next, ["compilerOptions", "jsx"], JSX, {
        formattingOptions: FORMAT,
      }),
    )
  }

  return { newText: next, changed: next !== text, unparseable: false }
}
