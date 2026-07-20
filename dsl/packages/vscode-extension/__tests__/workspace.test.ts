import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { discoverPipelines } from "../src/workspace/pipeline-discovery.js"
import {
  findProjectDir,
  resolveAliasTarget,
  resolveProjectContext,
} from "../src/workspace/project-context.js"

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(here, "fixtures")
const rootAlias = join(FIXTURES, "root-alias")
const srcAlias = join(FIXTURES, "src-alias")
const noConfig = join(FIXTURES, "no-config")

describe("findProjectDir", () => {
  it("walks up from a nested directory to the config root", () => {
    expect(findProjectDir(join(rootAlias, "pipelines", "alpha"))).toBe(
      rootAlias,
    )
  })

  it("returns the directory itself when the config is present there", () => {
    expect(findProjectDir(rootAlias)).toBe(rootAlias)
  })

  it("returns null when no config exists up the tree", () => {
    expect(findProjectDir(noConfig)).toBeNull()
  })
})

describe("resolveAliasTarget", () => {
  it('maps "@/*": ["./*"] to the project root', () => {
    expect(
      resolveAliasTarget(rootAlias, join(rootAlias, "tsconfig.json")),
    ).toBe(rootAlias)
  })

  it('maps "@/*": ["./src/*"] to <projectDir>/src', () => {
    expect(resolveAliasTarget(srcAlias, join(srcAlias, "tsconfig.json"))).toBe(
      join(srcAlias, "src"),
    )
  })

  it("falls back to the project root when there is no tsconfig", () => {
    expect(resolveAliasTarget(noConfig, null)).toBe(noConfig)
  })
})

describe("resolveProjectContext", () => {
  it("resolves projectDir, root alias target, and tsconfig path", () => {
    expect(resolveProjectContext(rootAlias)).toEqual({
      projectDir: rootAlias,
      aliasTarget: rootAlias,
      tsconfigPath: join(rootAlias, "tsconfig.json"),
    })
  })

  it("resolves the ./src alias target", () => {
    const ctx = resolveProjectContext(srcAlias)
    expect(ctx?.aliasTarget).toBe(join(srcAlias, "src"))
  })

  it("returns null outside a FlinkReactor project", () => {
    expect(resolveProjectContext(noConfig)).toBeNull()
  })
})

describe("discoverPipelines", () => {
  it("lists pipeline directories holding an index.tsx, sorted by name", () => {
    expect(discoverPipelines(rootAlias)).toEqual([
      {
        name: "alpha",
        entryPoint: join(rootAlias, "pipelines", "alpha", "index.tsx"),
      },
      {
        name: "beta",
        entryPoint: join(rootAlias, "pipelines", "beta", "index.tsx"),
      },
    ])
  })

  it("excludes directories without an index.tsx", () => {
    const names = discoverPipelines(rootAlias).map((p) => p.name)
    expect(names).not.toContain("not-a-pipeline")
  })

  it("returns an empty list when there is no pipelines/ directory", () => {
    expect(discoverPipelines(noConfig)).toEqual([])
  })
})
