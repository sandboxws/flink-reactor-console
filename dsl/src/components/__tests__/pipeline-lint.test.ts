import { describe, expect, it } from "vitest"
import { consumeValidationWarnings, Pipeline } from "@/components/pipeline.js"

describe("Pipeline state-heavy (RocksDB) lint", () => {
  it("warns when rocksdb has no explicit taskManager memory", () => {
    Pipeline({ name: "s", stateBackend: "rocksdb", children: [] })
    const warnings = consumeValidationWarnings()
    expect(warnings).toHaveLength(1)
    expect(warnings[0].level).toBe("warning")
    expect(warnings[0].message).toContain("1024m")
  })

  it("does not warn when taskManager memory is set", () => {
    Pipeline({
      name: "s",
      stateBackend: "rocksdb",
      resources: { taskManager: { memory: "4096m" } },
      children: [],
    })
    expect(consumeValidationWarnings()).toHaveLength(0)
  })

  it("warns when rocksdb.managed is disabled", () => {
    Pipeline({
      name: "s",
      stateBackend: "rocksdb",
      resources: { taskManager: { memory: "4096m" } },
      rocksdb: { managed: false },
      children: [],
    })
    const warnings = consumeValidationWarnings()
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain("managed")
  })

  it("does not warn for the hashmap backend", () => {
    Pipeline({ name: "s", stateBackend: "hashmap", children: [] })
    expect(consumeValidationWarnings()).toHaveLength(0)
  })
})
