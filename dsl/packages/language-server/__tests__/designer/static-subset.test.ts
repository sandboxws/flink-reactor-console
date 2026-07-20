// Static-subset verifier + pragma detection (visual-designer tasks 4.1/4.4)
// and the edit-safety matrix decision table (task 8.1).

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { decideEditSafety } from "../../src/designer/edit-safety.js"
import {
  hasDesignerPragma,
  resolveFileKind,
  verifyStaticSubset,
} from "../../src/designer/static-subset.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

const STATIC_HEADER = `// @flink-reactor designer
import { Filter, Pipeline } from "@flink-reactor/dsl"
`

describe("designer pragma + static-subset verification", () => {
  it("accepts the designer-managed fixture (identifier schema props allowed)", () => {
    const text = readFileSync(
      join(FIXTURES, "designer-managed-pipeline.tsx"),
      "utf8",
    )
    const result = verifyStaticSubset(text, "designer-managed-pipeline.tsx")
    expect(result.pragmaPresent).toBe(true)
    expect(result.violations).toEqual([])
    expect(resolveFileKind(text, "x.tsx").fileKind).toBe("designer-managed")
  })

  it("classifies the arbitrary fixture (no pragma) as arbitrary with a reason", () => {
    const text = readFileSync(
      join(FIXTURES, "designer-classifier-pipeline.tsx"),
      "utf8",
    )
    expect(hasDesignerPragma(text)).toBe(false)
    const kind = resolveFileKind(text, "x.tsx")
    expect(kind.fileKind).toBe("arbitrary")
    expect(kind.fileKindReason).toMatch(/designer-managed/)
  })

  it.each([
    [
      "loop",
      `${STATIC_HEADER}
const xs = [1, 2]
for (const x of xs) console.log(x)
export default (<Pipeline name="p"><Filter condition="a > 0" /></Pipeline>)
`,
      /loop/,
    ],
    [
      "if conditional",
      `${STATIC_HEADER}
if (process.env.X) console.log("x")
export default (<Pipeline name="p"><Filter condition="a > 0" /></Pipeline>)
`,
      /conditional/,
    ],
    [
      "ternary",
      `${STATIC_HEADER}
const mode = 1 > 0 ? "a" : "b"
export default (<Pipeline name="p"><Filter condition="a > 0" /></Pipeline>)
`,
      /conditional/,
    ],
    [
      "JSX spread attribute",
      `${STATIC_HEADER}
const extra = {}
export default (<Pipeline name="p"><Filter condition="a > 0" {...extra} /></Pipeline>)
`,
      /spread/,
    ],
    [
      "computed prop",
      `${STATIC_HEADER}
const conds = { a: "a > 0" }
export default (<Pipeline name="p"><Filter condition={conds.a} /></Pipeline>)
`,
      /computed prop/,
    ],
    [
      "dynamic JSX child",
      `${STATIC_HEADER}
const items = ["a"]
export default (<Pipeline name="p">{items.map((c) => (<Filter condition={c} />))}</Pipeline>)
`,
      /./, // any violation — map children trip several rules
    ],
  ])("flags a %s as a static-subset violation", (_label, source, reasonPattern) => {
    const result = verifyStaticSubset(source, "violating.tsx")
    expect(result.pragmaPresent).toBe(true)
    expect(result.violations.length).toBeGreaterThan(0)
    expect(result.violations[0]?.reason).toMatch(reasonPattern)
    const kind = resolveFileKind(source, "violating.tsx")
    expect(kind.fileKind).toBe("pragma-violated")
    expect(kind.fileKindReason).toMatch(/no longer satisfies/)
  })

  it("allows JSX comments and bare identifier props", () => {
    const source = `${STATIC_HEADER}
const Cond = "a > 0"
export default (
  <Pipeline name="p">
    {/* a comment is static */}
    <Filter condition={Cond} />
  </Pipeline>
)
`
    expect(verifyStaticSubset(source, "ok.tsx").violations).toEqual([])
  })
})

describe("edit-safety matrix (single decision point)", () => {
  it("scalar edits: editable safe everywhere, readOnly refused everywhere", () => {
    for (const fileKind of ["arbitrary", "designer-managed"] as const) {
      expect(
        decideEditSafety(
          { kind: "scalarProp", classification: "editable" },
          fileKind,
        ).safe,
      ).toBe(true)
      const refused = decideEditSafety(
        { kind: "scalarProp", classification: "readOnly" },
        fileKind,
      )
      expect(refused.safe).toBe(false)
      if (!refused.safe) expect(refused.reason).toMatch(/Edit in source/)
    }
  })

  it("structural + free wiring: refused on arbitrary, safe on designer-managed", () => {
    for (const kind of ["structural", "freeWiring"] as const) {
      expect(decideEditSafety({ kind }, "designer-managed").safe).toBe(true)
      for (const fileKind of ["arbitrary", "pragma-violated"] as const) {
        const refused = decideEditSafety({ kind }, fileKind)
        expect(refused.safe).toBe(false)
        if (!refused.safe) expect(refused.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it("regenerating an existing file from the canvas is always refused; a new file is safe", () => {
    for (const fileKind of ["arbitrary", "designer-managed"] as const) {
      const regen = decideEditSafety({ kind: "regenerateFile" }, fileKind)
      expect(regen.safe).toBe(false)
      expect(decideEditSafety({ kind: "generateNewFile" }, fileKind).safe).toBe(
        true,
      )
      expect(decideEditSafety({ kind: "view" }, fileKind).safe).toBe(true)
    }
  })
})
