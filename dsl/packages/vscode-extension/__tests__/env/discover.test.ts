// Environment discovery (cli-lifecycle-integration task 4.5): the lexical
// scan lists env names from conventional configs, tolerates strings/comments/
// nesting, and degrades to [] for configs it cannot read.

import { describe, expect, it } from "vitest"
import { scanEnvironmentNames } from "../../src/env/discover"

describe("scanEnvironmentNames", () => {
  it("lists the env names of a conventional config", () => {
    const config = `import { defineConfig } from '@flink-reactor/dsl';

export default defineConfig({
  flink: { version: '2.1' },
  environments: {
    development: {
      cluster: { url: 'http://localhost:8081' },
      pipelines: { '*': { parallelism: 1 } },
    },
    production: {
      cluster: { url: 'http://flink.prod:8081' },
    },
  },
});
`
    expect(scanEnvironmentNames(config)).toEqual(["development", "production"])
  })

  it("supports quoted env names and ignores nested keys/comments/strings", () => {
    const config = `export default defineConfig({
  environments: {
    // a comment with a fake key: nope
    "staging-eu": {
      cluster: { url: "http://{not-a-key}:8081" }, // braces in a string
      pipelines: { orders: { parallelism: 2 } },
    },
    production: { cluster: { url: 'x' } },
  },
})
`
    expect(scanEnvironmentNames(config)).toEqual(["staging-eu", "production"])
  })

  it("returns [] when there is no environments block", () => {
    expect(
      scanEnvironmentNames("export default defineConfig({ flink: {} })"),
    ).toEqual([])
  })
})
