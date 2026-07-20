import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { FlussCatalog, PaimonCatalog } from "@/components/catalogs.js"
import { Pipeline } from "@/components/pipeline.js"
import { KafkaSink } from "@/components/sinks.js"
import { GenericSource, JdbcSource, KafkaSource } from "@/components/sources.js"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { Field, Schema } from "@/core/schema.js"
import { validateSecretHygiene } from "@/core/secret-hygiene.js"
import { secretRef } from "@/core/secret-ref.js"

const EventSchema = Schema({
  fields: { id: Field.BIGINT() },
})

function chain() {
  return KafkaSink({
    topic: "out",
    format: "json",
    bootstrapServers: "k:9092",
    children: KafkaSource({
      topic: "in",
      format: "json",
      bootstrapServers: "k:9092",
      schema: EventSchema,
    }),
  })
}

describe("validateSecretHygiene", () => {
  beforeEach(() => {
    resetNodeIdCounter()
  })

  afterEach(() => {
    delete process.env.FR_TEST_SECRET_VALUE
  })

  it("warns when a SecretRef-capable slot holds a plain string (tier 1)", () => {
    const cat = FlussCatalog({
      name: "fluss",
      bootstrapServers: "fluss:9123",
      saslUsername: "app",
      saslPassword: "hunter2-literal",
    })
    const root = Pipeline({ name: "p", children: [cat.node, chain()] })

    const diags = validateSecretHygiene(root)

    const finding = diags.find((d) => d.component === "FlussCatalog")
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe("warning")
    expect(finding?.category).toBe("connector")
    expect(finding?.message).toContain("saslPassword")
    expect(finding?.message).toContain("secretRef()")
    expect(finding?.details?.sensitiveOptionKeys).toEqual(["saslPassword"])
  })

  it("does not warn when the slot holds a secretRef()", () => {
    const cat = FlussCatalog({
      name: "fluss",
      bootstrapServers: "fluss:9123",
      saslPassword: secretRef("fluss-sasl"),
    })
    const root = Pipeline({ name: "p", children: [cat.node, chain()] })

    expect(validateSecretHygiene(root)).toEqual([])
  })

  it("tier-1 findings survive on the editor surface; tier-2 do not", () => {
    const cat = FlussCatalog({
      name: "fluss",
      bootstrapServers: "fluss:9123",
      saslPassword: "literal",
    })
    const generic = GenericSource({
      connector: "faker",
      schema: EventSchema,
      options: { "auth.token": "literal-token" },
    })
    const root = Pipeline({
      name: "p",
      children: [
        cat.node,
        KafkaSink({
          topic: "out",
          format: "json",
          bootstrapServers: "k:9092",
          children: generic,
        }),
      ],
    })

    const editor = validateSecretHygiene(root, { surface: "editor" })
    const cli = validateSecretHygiene(root, { surface: "cli" })

    expect(editor).toHaveLength(1)
    expect(editor[0].component).toBe("FlussCatalog")
    expect(cli).toHaveLength(2)
    expect(cli.map((d) => d.component).sort()).toEqual([
      "FlussCatalog",
      "GenericSource",
    ])
  })

  it("warns on sensitive generic options with literals (tier 2, cli)", () => {
    const generic = GenericSource({
      connector: "faker",
      schema: EventSchema,
      options: {
        "properties.sasl.jaas.config": "…password=hunter2;",
        "scan.startup.mode": "earliest",
      },
    })
    const root = Pipeline({
      name: "p",
      children: KafkaSink({
        topic: "out",
        format: "json",
        bootstrapServers: "k:9092",
        children: generic,
      }),
    })

    const diags = validateSecretHygiene(root)

    expect(diags).toHaveLength(1)
    expect(diags[0].details?.sensitiveOptionKeys).toEqual([
      "properties.sasl.jaas.config",
    ])
  })

  it("skips ${env:VAR} placeholders and env-sourced values", () => {
    process.env.FR_TEST_SECRET_VALUE = "from-the-environment"
    const generic = GenericSource({
      connector: "faker",
      schema: EventSchema,
      options: {
        "auth.token": "${env:AUTH_TOKEN}",
        password: "from-the-environment",
      },
    })
    const root = Pipeline({
      name: "p",
      children: KafkaSink({
        topic: "out",
        format: "json",
        bootstrapServers: "k:9092",
        children: generic,
      }),
    })

    expect(validateSecretHygiene(root)).toEqual([])
  })

  it("warns on PaimonCatalog literal s3 keys with env-injection guidance", () => {
    const cat = PaimonCatalog({
      name: "paimon",
      warehouse: "s3://bucket/wh",
      s3AccessKey: "AKIAEXAMPLELITERAL",
      s3SecretKey: "verysecretliteral",
    })
    const root = Pipeline({ name: "p", children: [cat.node, chain()] })

    const diags = validateSecretHygiene(root)

    expect(diags).toHaveLength(2)
    for (const d of diags) {
      expect(d.message).toContain("process.env")
      expect(d.message).not.toContain("secretRef()")
    }
  })

  it("warns on JDBC urls embedding a password", () => {
    const source = JdbcSource({
      table: "users",
      url: "jdbc:postgresql://db:5432/app?user=app&password=hunter2",
      schema: EventSchema,
    })
    const root = Pipeline({
      name: "p",
      children: KafkaSink({
        topic: "out",
        format: "json",
        bootstrapServers: "k:9092",
        children: source,
      }),
    })

    const diags = validateSecretHygiene(root)

    expect(diags).toHaveLength(1)
    expect(diags[0].component).toBe("JdbcSource")
    expect(diags[0].message).toContain("URL")
  })

  it("stays silent on clean pipelines", () => {
    const root = Pipeline({ name: "p", children: chain() })
    expect(validateSecretHygiene(root)).toEqual([])
  })
})
