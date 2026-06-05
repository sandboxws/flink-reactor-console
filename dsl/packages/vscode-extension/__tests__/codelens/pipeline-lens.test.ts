// Pipeline identity derivation for the CodeLens (task 5.5's unit half — the
// lens row itself is asserted in the e2e suite): only `pipelines/<name>/
// index.tsx` paths yield a pipeline; components/schemas/nested files do not.

import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { pipelineNameFor } from "../../src/codelens/pipeline-name"

describe("pipelineNameFor", () => {
  it("derives the pipeline from a pipelines/<name>/index.tsx path", () => {
    expect(
      pipelineNameFor(join("/work/app", "pipelines", "orders", "index.tsx")),
    ).toBe("orders")
  })

  it.each([
    [join("/work/app", "pipelines", "orders", "helpers.tsx")], // not index
    [join("/work/app", "schemas", "order.ts")], // not a pipeline dir
    [join("/work/app", "components", "orders", "index.tsx")], // wrong parent
    [join("/work/app", "pipelines", "orders", "nested", "index.tsx")], // nested
  ])("yields no pipeline for %s", (path) => {
    expect(pipelineNameFor(path)).toBeUndefined()
  })
})
