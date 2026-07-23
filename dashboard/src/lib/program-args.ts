/**
 * @module program-args
 *
 * Converts the submit form's free-text program-arguments field into the token
 * list Flink 2.0+ expects for `programArgsList`.
 *
 * The form takes **one argument per line**: each non-empty line is a single
 * token, verbatim (after trimming surrounding whitespace). This deliberately
 * avoids re-tokenizing a single string — the ambiguity of splitting
 * `--query "SELECT * FROM t"` on whitespace is exactly what `programArgsList`
 * exists to eliminate. A value that contains spaces (a SQL statement, a path, a
 * JSON blob) is simply its own line and needs no quoting or escaping.
 */

/**
 * Parse a program-arguments textarea value into a token list.
 *
 * @param input Raw textarea contents (lines separated by `\n` or `\r\n`).
 * @returns One token per non-empty line, each trimmed. Blank lines are dropped.
 */
export function parseProgramArgs(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
