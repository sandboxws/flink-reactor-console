// Pipeline-test file scanning (test-explorer §1.4/§2): discover the
// `describe`/`it` blocks of a `tests/pipelines/*.test.ts` file with their
// source positions, and tag the `it` cases that assert `toMatchSnapshot()` —
// flagging the SQL ones (`expect(sql)`/`expect(result.sql)`) for the golden-
// diff viewer and per-test snapshot updates.
//
// Lexical scan, same trade-off as `env/discover.ts`: the extension host does
// not bundle the TypeScript compiler (~8 MB) for a structure this
// conventional — the template contract (`templatePipelineTestStub`) pins the
// shape (`describe('<name> pipeline', …)` wrapping `it('…', …)` with
// `expect(sql).toMatchSnapshot()`), and the unit suite locks the scanner to
// it. Strings and comments are skipped wholesale; nesting derives from brace
// depth. Dynamic/templated titles are skipped (the runner surfaces their
// results as synthetic children — task 3.6 — so nothing is lost).

export interface ScannedTest {
  readonly kind: "describe" | "it"
  readonly title: string
  /** 0-based line of the `describe(`/`it(` callsite. */
  readonly line: number
  readonly children: readonly ScannedTest[]
  /** True when the case body contains a `toMatchSnapshot()` assertion. */
  readonly snapshot: boolean
  /** True when a snapshot assertion targets the generated SQL
   *  (`expect(sql)…` / `expect(result.sql)…` / `expect(….sql)…`). */
  readonly sqlSnapshot: boolean
}

interface Frame {
  kind: "describe" | "it"
  title: string
  line: number
  children: MutableTest[]
  bodyText: string[]
  /** Brace depth BEFORE the callback body opened; the frame closes when
   *  depth returns to it. -1 while the body has not opened yet. */
  closesAt: number
  /** A dynamic (interpolated) title: consume the subtree but emit nothing —
   *  the runner surfaces its results as synthetic children instead. */
  discard?: boolean
}

interface MutableTest {
  kind: "describe" | "it"
  title: string
  line: number
  children: MutableTest[]
  snapshot: boolean
  sqlSnapshot: boolean
}

const CALLSITE = /^(describe|it|test)\s*\(\s*(["'`])/

export function scanTestFile(text: string): readonly ScannedTest[] {
  const roots: MutableTest[] = []
  const stack: Frame[] = []
  let depth = 0
  let line = 0
  let i = 0

  const closeFrame = (frame: Frame): void => {
    if (frame.discard) return // dynamic-title subtree — dropped wholesale
    const body = frame.bodyText.join("")
    const node: MutableTest = {
      kind: frame.kind,
      title: frame.title,
      line: frame.line,
      children: frame.children,
      snapshot: frame.kind === "it" && /\.toMatchSnapshot\s*\(/.test(body),
      sqlSnapshot:
        frame.kind === "it" &&
        /expect\s*\(\s*(?:[A-Za-z_$][\w$]*\.)?sql\s*\)[\s\S]{0,80}?\.toMatchSnapshot\s*\(/.test(
          body,
        ),
    }
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const record = (chunk: string): void => {
    // Body text accumulates into the innermost OPEN frame (an `it` body for
    // snapshot detection; describes accumulate too, harmlessly).
    const frame = stack[stack.length - 1]
    if (frame && frame.closesAt !== -1) frame.bodyText.push(chunk)
  }

  while (i < text.length) {
    const ch = text[i]

    if (ch === "\n") {
      line++
      record("\n")
      i++
      continue
    }
    // ── Comments / strings: skip, but keep their bytes in the body text
    //    (string content like 'sql' is never what the regexes match on —
    //    they match the CODE around expect(...)). Comments are dropped so a
    //    commented-out toMatchSnapshot does not tag the test.
    if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i)
      i = nl === -1 ? text.length : nl
      continue
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      const slice = text.slice(i, end === -1 ? text.length : end + 2)
      line += slice.split("\n").length - 1
      i = end === -1 ? text.length : end + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const { end, value, newlines } = readString(text, i)
      record(text.slice(i, end))
      void value
      line += newlines
      i = end
      continue
    }

    // ── describe(/it(/test( with a string-literal title ───────────────
    if (/[A-Za-z]/.test(ch ?? "") && !/[\w$.]/.test(text[i - 1] ?? "")) {
      const rest = text.slice(i, i + 200)
      const match = CALLSITE.exec(rest)
      if (match) {
        const fn = match[1] === "test" ? "it" : (match[1] as "describe" | "it")
        const quoteIndex = i + (match[0].length - 1)
        const { end, value } = readString(text, quoteIndex)
        stack.push({
          kind: fn,
          title: value ?? "",
          line,
          children: [],
          bodyText: [],
          closesAt: -1,
          ...(value === null ? { discard: true } : {}),
        })
        i = end
        continue
      }
      // An ordinary identifier — consume it wholesale so a name like
      // `itemize` is never mistaken for `it(`.
      let j = i
      while (j < text.length && /[\w$]/.test(text[j] ?? "")) j++
      record(text.slice(i, j))
      i = j
      continue
    }

    if (ch === "{") {
      depth++
      const frame = stack[stack.length - 1]
      // The first `{` after a recorded callsite opens its callback body.
      if (frame && frame.closesAt === -1) frame.closesAt = depth - 1
      else record("{")
      i++
      continue
    }
    if (ch === "}") {
      depth--
      const frame = stack[stack.length - 1]
      if (frame && frame.closesAt === depth) {
        stack.pop()
        closeFrame(frame)
      } else {
        record("}")
      }
      i++
      continue
    }

    record(ch ?? "")
    i++
  }

  // Unterminated frames (parse drift) still close so nothing is lost.
  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame) closeFrame(frame)
  }
  return roots
}

function readString(
  text: string,
  start: number,
): { end: number; value: string | null; newlines: number } {
  const quote = text[start]
  let i = start + 1
  let value = ""
  let newlines = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === "\\") {
      value += text[i + 1] ?? ""
      i += 2
      continue
    }
    if (ch === "\n") newlines++
    if (ch === quote) return { end: i + 1, value, newlines }
    // A template literal with interpolation is a DYNAMIC title — bail.
    if (quote === "`" && ch === "$" && text[i + 1] === "{") {
      const close = text.indexOf("`", i)
      return {
        end: close === -1 ? text.length : close + 1,
        value: null,
        newlines,
      }
    }
    value += ch
    i++
  }
  return { end: text.length, value: null, newlines }
}
