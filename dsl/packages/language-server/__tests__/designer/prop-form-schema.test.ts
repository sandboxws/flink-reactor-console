// Prop-form schema projection tests (visual-designer, tasks 1.1–1.5).
//
// Snapshots pin the generated form schema for the representative components
// (`KafkaSource`, `Filter`, `IcebergSink`, `Join`): because the table is a
// build-time projection of the DSL's typed prop interfaces, a type change
// (added union member, prop made required) reaches the form via regeneration
// alone — the snapshot diff IS the proof that no form-code edit is needed.
// If this fails after a DSL change, regenerate:
//   pnpm --filter @flink-reactor/language-server gen:prop-form-schema

import {
  DSL_COMPONENTS,
  HIERARCHY_ONLY_COMPONENTS,
} from "@flink-reactor/ts-plugin/rules"
import { describe, expect, it } from "vitest"
import { PROP_FORM_SCHEMA } from "../../src/designer/prop-form-schema.generated.js"

const KNOWN = new Set<string>([
  ...DSL_COMPONENTS.keys(),
  ...HIERARCHY_ONLY_COMPONENTS,
])

describe("prop-form schema projection", () => {
  it("snapshots the representative components (KafkaSource, Filter, IcebergSink, Join)", () => {
    for (const component of ["KafkaSource", "Filter", "IcebergSink", "Join"]) {
      expect(PROP_FORM_SCHEMA[component]).toMatchSnapshot(component)
    }
  })

  it("projects only known components (no drift vs the inventory)", () => {
    const unknown = Object.keys(PROP_FORM_SCHEMA).filter((c) => !KNOWN.has(c))
    expect(unknown).toEqual([])
  })

  it("maps a string-literal union to an enum option list (KafkaFormat)", () => {
    const format = PROP_FORM_SCHEMA.KafkaSource?.fields.find(
      (f) => f.name === "format",
    )
    expect(format?.inputKind).toBe("enum")
    expect(format?.options).toEqual(
      expect.arrayContaining([
        "json",
        "avro",
        "csv",
        "debezium-json",
        "debezium-avro",
        "debezium-protobuf",
        "canal-json",
        "maxwell-json",
      ]),
    )
    expect(format?.required).toBe(false) // `readonly format?:`
  })

  it("marks a prop required from optionality OR the requireProps(...) list", () => {
    const kafka = PROP_FORM_SCHEMA.KafkaSource
    expect(kafka?.runtimeRequired).toEqual(["topic", "schema"])
    const topic = kafka?.fields.find((f) => f.name === "topic")
    const schema = kafka?.fields.find((f) => f.name === "schema")
    expect(topic?.required).toBe(true)
    expect(schema?.required).toBe(true)
  })

  it("carries JSDoc text as field help", () => {
    const registry = PROP_FORM_SCHEMA.KafkaSource?.fields.find(
      (f) => f.name === "schemaRegistryUrl",
    )
    expect(registry?.help).toMatch(/Schema Registry/i)
  })

  it("marks non-literal/object/generic prop types read-only-in-form", () => {
    const schema = PROP_FORM_SCHEMA.KafkaSource?.fields.find(
      (f) => f.name === "schema",
    )
    expect(schema?.inputKind).toBe("object") // SchemaDefinition<T>
    expect(schema?.readOnlyInForm).toBe(true)

    const left = PROP_FORM_SCHEMA.Join?.fields.find((f) => f.name === "left")
    expect(left?.readOnlyInForm).toBe(true) // ConstructNode

    const tap = PROP_FORM_SCHEMA.Filter?.fields.find((f) => f.name === "tap")
    expect(tap?.readOnlyInForm).toBe(true) // boolean | TapConfig mixed union
  })

  it("derives literal input kinds (string/number/boolean/array)", () => {
    const fields = new Map(
      PROP_FORM_SCHEMA.IcebergSink?.fields.map((f) => [f.name, f]),
    )
    expect(fields.get("database")?.inputKind).toBe("string")
    expect(fields.get("targetFileSizeMB")?.inputKind).toBe("number")
    expect(fields.get("formatVersion")?.inputKind).toBe("number") // 1 | 2
    expect(fields.get("upsertEnabled")?.inputKind).toBe("boolean")
    expect(fields.get("primaryKey")?.inputKind).toBe("array") // readonly string[]
  })
})
