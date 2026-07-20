import { describe, expect, it, vi } from "vitest"
import {
  LOCAL_SCHEMA_REGISTRY_URL,
  registerBody,
  registerSeedSchemas,
  SEED_SUBJECTS,
  type SeedSubject,
  subjectFor,
} from "@/cli/cluster/schema-registry-seed.js"

const okResponse = () => ({ ok: true, status: 200 }) as Response

describe("subjectFor", () => {
  it("defaults to Confluent TopicNameStrategy (`<topic>-value`)", () => {
    expect(
      subjectFor({ topic: "page-views", domain: "analytics", jsonSchema: {} }),
    ).toBe("page-views-value")
  })

  it("honors an explicit subject override", () => {
    expect(
      subjectFor({
        topic: "t",
        domain: "ecommerce",
        subject: "custom-subject",
        jsonSchema: {},
      }),
    ).toBe("custom-subject")
  })
})

describe("registerBody", () => {
  it("wraps the row schema as a stringified JSON-Schema payload", () => {
    const entry: SeedSubject = {
      topic: "t",
      domain: "ecommerce",
      jsonSchema: { type: "object", properties: { a: { type: "integer" } } },
    }
    const body = JSON.parse(registerBody(entry))
    expect(body.schemaType).toBe("JSON")
    // `schema` must itself be a JSON *string* — that's how Confluent/Karapace
    // and the introspection client (`JSON.parse(payload.schema)`) exchange it.
    expect(typeof body.schema).toBe("string")
    expect(JSON.parse(body.schema)).toEqual(entry.jsonSchema)
  })
})

describe("registerSeedSchemas", () => {
  it("POSTs every seed subject to the registry versions endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse())
    const result = await registerSeedSchemas({ fetchImpl })

    expect(result.registered).toHaveLength(SEED_SUBJECTS.length)
    expect(result.failed).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(SEED_SUBJECTS.length)

    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(
      `${LOCAL_SCHEMA_REGISTRY_URL}/subjects/${encodeURIComponent(
        subjectFor(SEED_SUBJECTS[0]!),
      )}/versions`,
    )
    expect(init?.method).toBe("POST")
  })

  it("filters by topic when `topics` is supplied", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse())
    const result = await registerSeedSchemas({
      fetchImpl,
      topics: ["cdc.inventory.products"],
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.registered).toEqual(["cdc.inventory.products-value"])
  })

  it("targets a custom registry URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse())
    await registerSeedSchemas({
      fetchImpl,
      registryUrl: "http://registry:9999",
      subjects: [{ topic: "t", domain: "ecommerce", jsonSchema: {} }],
    })
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "http://registry:9999/subjects/t-value/versions",
    )
  })

  it("reports non-ok responses as failed without throwing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => ({ ok: false, status: 422 }) as Response,
    )
    const result = await registerSeedSchemas({
      fetchImpl,
      subjects: [{ topic: "t", domain: "ecommerce", jsonSchema: {} }],
    })
    expect(result.registered).toEqual([])
    expect(result.failed).toEqual(["t-value"])
  })

  it("swallows a thrown fetch (registry down) and reports it as failed", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("ECONNREFUSED")
    })
    const result = await registerSeedSchemas({
      fetchImpl,
      subjects: [{ topic: "t", domain: "ecommerce", jsonSchema: {} }],
    })
    expect(result.failed).toEqual(["t-value"])
  })
})
