// Test-file scanner (test-explorer §1.4/§2): describe/it discovery with
// positions, snapshot tagging, SQL-snapshot flagging — pinned to the
// template contract (`templatePipelineTestStub`) plus the non-tagging cases.

import { describe, expect, it } from "vitest"
import { scanTestFile } from "../../src/test-explorer/test-scan"

// The exact shape `templatePipelineTestStub` emits.
const TEMPLATE_TEST = `import { beforeEach, describe, expect, it } from 'vitest'
import {
  type ConstructNode,
  resetNodeIdCounter,
  synthesizeApp,
} from '@flink-reactor/dsl'
import pipeline from '../../pipelines/orders/index.js'

function synth(node: ConstructNode): string {
  const result = synthesizeApp({ name: 'orders', children: [node] })
  return result.pipelines[0].sql.sql
}

describe('orders pipeline', () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  it('synthesizes stable SQL', () => {
    const sql = synth(pipeline)

    expect(sql).toMatchSnapshot()

    expect(sql).toMatch(/INSERT INTO/)
  })
})
`

describe("scanTestFile", () => {
  it("discovers the template's describe/it tree with positions", () => {
    const tree = scanTestFile(TEMPLATE_TEST)
    expect(tree).toHaveLength(1)
    const suite = tree[0]
    expect(suite?.kind).toBe("describe")
    expect(suite?.title).toBe("orders pipeline")
    expect(suite?.line).toBe(13)
    expect(suite?.children).toHaveLength(1)
    const test = suite?.children[0]
    expect(test?.kind).toBe("it")
    expect(test?.title).toBe("synthesizes stable SQL")
    expect(test?.line).toBe(18)
  })

  it("tags the SQL snapshot test for the golden-diff (template form)", () => {
    const test = scanTestFile(TEMPLATE_TEST)[0]?.children[0]
    expect(test?.snapshot).toBe(true)
    expect(test?.sqlSnapshot).toBe(true)
  })

  it("tags result.sql snapshots and leaves CRD/object snapshots non-SQL", () => {
    const source = `describe('x', () => {
  it('sql snapshot', () => {
    expect(result.sql).toMatchSnapshot()
  })
  it('crd snapshot', () => {
    expect(asFlinkDeployment(result.crd)).toMatchSnapshot()
  })
})
`
    const suite = scanTestFile(source)[0]
    const [sqlTest, crdTest] = suite?.children ?? []
    expect(sqlTest?.snapshot).toBe(true)
    expect(sqlTest?.sqlSnapshot).toBe(true)
    expect(crdTest?.snapshot).toBe(true)
    expect(crdTest?.sqlSnapshot).toBe(false)
  })

  it("does not tag toMatch/assertFlinkDeployment-only cases (task 2.3)", () => {
    const source = `describe('x', () => {
  it('load-bearing patterns only', () => {
    expect(sql).toMatch(/TUMBLE/)
    assertFlinkDeployment(result)
  })
})
`
    const test = scanTestFile(source)[0]?.children[0]
    expect(test?.snapshot).toBe(false)
    expect(test?.sqlSnapshot).toBe(false)
  })

  it("ignores commented-out snapshot assertions and identifier prefixes", () => {
    const source = `describe('x', () => {
  it('clean', () => {
    // expect(sql).toMatchSnapshot()
    const itemized = items(sql)
    expect(itemized).toBeDefined()
  })
})
`
    const test = scanTestFile(source)[0]?.children[0]
    expect(test?.title).toBe("clean")
    expect(test?.snapshot).toBe(false)
  })

  it("nests sibling describes and skips dynamic titles", () => {
    const source = `describe('outer', () => {
  describe('inner-a', () => {
    it('a1', () => {})
  })
  describe(\`dyn-\${x}\`, () => {
    it('lost', () => {})
  })
  it('outer-direct', () => {})
})
`
    const tree = scanTestFile(source)
    const outer = tree[0]
    expect(outer?.title).toBe("outer")
    const titles = outer?.children.map((c) => c.title)
    expect(titles).toContain("inner-a")
    expect(titles).toContain("outer-direct")
    // The dynamic-title describe is not discovered (its children surface as
    // synthetic results at run time instead).
    expect(titles).not.toContain("lost")
  })
})
