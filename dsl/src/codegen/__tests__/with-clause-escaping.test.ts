import { describe, expect, it } from "vitest"
import { Pipeline } from "@/components/pipeline.js"
import { KafkaSink } from "@/components/sinks.js"
import { KafkaSource } from "@/components/sources.js"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { Field, Schema } from "@/core/schema.js"
import { synth } from "@/testing/synth.js"

/**
 * Integration guard for connector-option / SET string-literal escaping.
 *
 * `quoteStringLiteral` has always been unit-tested in isolation, but nothing
 * verified that the DDL/SET emitters actually *call* it — and for a long time
 * they didn't. A connector value (or user-provided option key) containing a
 * single quote would break out of its literal and emit malformed SQL. These
 * tests pin that the doubled-quote form is emitted end-to-end.
 */

const schema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})

describe("connector option / SET string-literal escaping", () => {
  it("doubles single quotes in connector WITH-clause values", () => {
    resetNodeIdCounter()
    const source = KafkaSource({
      topic: "orders",
      format: "json",
      bootstrapServers: "kafka:9092",
      consumerGroup: "team's-group",
      schema,
    })
    const sink = KafkaSink({
      topic: "out",
      format: "json",
      bootstrapServers: "kafka:9092",
      children: [source],
    })

    const { sql } = synth(Pipeline({ name: "esc", children: [sink] }))

    // Escaped (well-formed) form present…
    expect(sql).toContain("'properties.group.id' = 'team''s-group'")
    // …and the raw, statement-breaking form absent.
    expect(sql).not.toContain("= 'team's-group'")
  })

  it("doubles single quotes in SET keys and values (flinkConfig)", () => {
    resetNodeIdCounter()
    const source = KafkaSource({
      topic: "orders",
      format: "json",
      bootstrapServers: "kafka:9092",
      schema,
    })
    const sink = KafkaSink({
      topic: "out",
      format: "json",
      bootstrapServers: "kafka:9092",
      children: [source],
    })

    const { sql } = synth(
      Pipeline({
        name: "esc",
        // Quote in both the key and the value exercises sqlOption on both sides.
        flinkConfig: { "weird'key": "a'b" },
        children: [sink],
      }),
    )

    expect(sql).toContain("SET 'weird''key' = 'a''b';")
  })
})
