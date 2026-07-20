// Parity check for the build-time prop-metadata projection (task 7.1).
//
// Guards against drift between the generated projection and the canonical
// component inventory: every projected component must be a real component, and
// the core connectors must all be covered with their required props. Mirrors
// the ts-plugin's rule-parity test. If this fails after a DSL change, run:
//   pnpm --filter @flink-reactor/language-server gen:prop-metadata

import {
  DSL_COMPONENTS,
  HIERARCHY_ONLY_COMPONENTS,
} from "@flink-reactor/ts-plugin/rules"
import { describe, expect, it } from "vitest"
import { PROP_METADATA } from "../../src/providers/completion/prop-metadata.generated.js"

const KNOWN = new Set<string>([
  ...DSL_COMPONENTS.keys(),
  ...HIERARCHY_ONLY_COMPONENTS,
])

describe("prop-metadata projection parity", () => {
  it("projects only known components (no drift vs the inventory)", () => {
    const unknown = Object.keys(PROP_METADATA).filter((c) => !KNOWN.has(c))
    expect(unknown).toEqual([])
  })

  it("covers every core connector with its required props", () => {
    const connectors = [
      "KafkaSource",
      "KafkaSink",
      "JdbcSource",
      "JdbcSink",
      "FileSystemSink",
      "GenericSource",
      "GenericSink",
      "IcebergSink",
      "PaimonSink",
    ]
    for (const c of connectors) {
      const props = PROP_METADATA[c]
      expect(props, `missing projection for ${c}`).toBeDefined()
      expect(
        props.some((p) => p.required),
        `${c} should have at least one required prop`,
      ).toBe(true)
    }
  })

  it("resolves string-literal-union props into enum literals", () => {
    const format = PROP_METADATA.KafkaSource?.find((p) => p.name === "format")
    expect(format?.enumValues).toEqual(
      expect.arrayContaining(["json", "avro", "debezium-json"]),
    )
  })
})
