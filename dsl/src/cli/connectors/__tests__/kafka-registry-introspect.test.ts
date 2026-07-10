import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  defaultSubject,
  introspectKafkaSubject,
  resetRegistryIntrospectCache,
} from "@/cli/connectors/kafka-registry-introspect.js"

const avroSchema = {
  type: "record",
  name: "Order",
  fields: [
    { name: "order_id", type: "long" },
    {
      name: "amount",
      type: { type: "bytes", logicalType: "decimal", precision: 10, scale: 2 },
    },
    {
      name: "created_at",
      type: { type: "long", logicalType: "timestamp-millis" },
    },
  ],
}

const jsonSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    price: { type: "number" },
    created: { type: "string", format: "date-time" },
  },
}

function fakeResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number },
): unknown {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  }
}

function stubFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  const fetchMock = vi.fn().mockResolvedValue(fakeResponse(body, init))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  resetRegistryIntrospectCache()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("defaultSubject", () => {
  it("uses TopicNameStrategy (<topic>-value)", () => {
    expect(defaultSubject("orders")).toBe("orders-value")
  })
})

describe("introspectKafkaSubject", () => {
  it("fetches + maps an Avro subject (schemaType omitted)", async () => {
    const fetchMock = stubFetch({ schema: JSON.stringify(avroSchema) })

    const cols = await introspectKafkaSubject({
      registryUrl: "http://reg:8081",
      topic: "orders",
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://reg:8081/subjects/orders-value/versions/latest",
    )
    expect(cols.map((c) => [c.name, c.type])).toEqual([
      ["order_id", "BIGINT"],
      ["amount", "DECIMAL(10, 2)"],
      ["created_at", "TIMESTAMP(3)"],
    ])
  })

  it("fetches + maps a JSON subject", async () => {
    stubFetch({ schema: JSON.stringify(jsonSchema), schemaType: "JSON" })

    const cols = await introspectKafkaSubject({
      registryUrl: "http://reg:8081",
      topic: "events",
    })
    expect(cols.map((c) => [c.name, c.type])).toEqual([
      ["id", "BIGINT"],
      ["price", "DOUBLE"],
      ["created", "TIMESTAMP(3)"],
    ])
  })

  it("honors an explicit subject override and strips trailing slash", async () => {
    const fetchMock = stubFetch({ schema: JSON.stringify(avroSchema) })
    await introspectKafkaSubject({
      registryUrl: "http://reg:8081/",
      topic: "orders",
      subject: "custom-subject",
    })
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://reg:8081/subjects/custom-subject/versions/latest",
    )
  })

  it("sends basic auth when credentials are given", async () => {
    const fetchMock = stubFetch({ schema: JSON.stringify(avroSchema) })
    await introspectKafkaSubject({
      registryUrl: "http://reg:8081",
      topic: "orders",
      auth: { username: "key", password: "secret" },
    })
    const init = fetchMock.mock.calls[0][1] as {
      headers: Record<string, string>
    }
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("key:secret").toString("base64")}`,
    )
  })

  it("caches — a second call makes no new request", async () => {
    const fetchMock = stubFetch({ schema: JSON.stringify(avroSchema) })
    await introspectKafkaSubject({
      registryUrl: "http://reg:8081",
      topic: "orders",
    })
    await introspectKafkaSubject({
      registryUrl: "http://reg:8081",
      topic: "orders",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("throws a clear error for a Protobuf subject", async () => {
    stubFetch({ schema: "syntax = 'proto3';", schemaType: "PROTOBUF" })
    await expect(
      introspectKafkaSubject({ registryUrl: "http://reg:8081", topic: "p" }),
    ).rejects.toThrow(/Protobuf/)
  })

  it("throws a subject-not-found error on 404", async () => {
    stubFetch({}, { ok: false, status: 404 })
    await expect(
      introspectKafkaSubject({
        registryUrl: "http://reg:8081",
        topic: "missing",
      }),
    ).rejects.toThrow(/not found/)
  })

  it("throws an auth error on 401", async () => {
    stubFetch({}, { ok: false, status: 401 })
    await expect(
      introspectKafkaSubject({ registryUrl: "http://reg:8081", topic: "x" }),
    ).rejects.toThrow(/authentication failed/)
  })
})
