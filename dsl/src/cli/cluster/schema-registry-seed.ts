// Schema-registry seeding for the local Kafka stack.
//
// The bundled Karapace registry (see the `schema-registry` service in
// docker-compose.yml / manifests/02b-schema-registry.yaml) exists so that
// `flink-reactor schema generate` can introspect the seeded Kafka topics the
// same way it introspects a real Confluent Schema Registry. This module holds
// the declarative topic → row-schema table and a `fetch`-based registrar.
//
// Design note — we register the *logical row* schema, not the Debezium
// envelope the producers emit. The templates read these topics with
// `format="json"` / `format="debezium-json"`, both of which are
// registry-free at runtime (the schema lives in the DSL). The registry is
// consulted *only* by `schema generate`, which wants the row columns —
// exactly what the shipped `schemas/*.ts` module declares. Keeping this table
// aligned with those modules is the round-trip contract enforced in the
// template test suite.
import pc from "picocolors"

/** Host URL the published Schema Registry port maps to (compose: 8082 → 8081). */
export const LOCAL_SCHEMA_REGISTRY_URL = "http://localhost:8082"

/** Confluent/Karapace subject-register content type. */
const REGISTRY_CONTENT_TYPE = "application/vnd.schemaregistry.v1+json"

export interface SeedSubject {
  /** Kafka topic the schema describes. */
  readonly topic: string
  /** Subject name. Defaults to `<topic>-value` (Confluent TopicNameStrategy). */
  readonly subject?: string
  /**
   * JSON Schema (draft-07 shape) describing one row. Mirrors the template's
   * shipped `schemas/<name>.ts` so `schema generate` reproduces that module.
   */
  readonly jsonSchema: Record<string, unknown>
  /**
   * A small deterministic set of plain-JSON rows the minikube (`sim`) lane
   * produces onto the topic so its pipelines have data. The Docker lane uses
   * the richer randomized producers in `cdc-publisher.ts`; both share this
   * table's schemas, which is what `schema generate` cares about.
   */
  readonly sampleRows?: readonly Record<string, unknown>[]
}

// Row schemas for the topics the CDC publisher seeds today. Extend this table
// (in lockstep with each template's `sources` + `schemas/*.ts`) as new Kafka
// templates are wired up. `integer` → BIGINT, `number` → DOUBLE, `string` →
// STRING, `string`+`format: date-time` → TIMESTAMP(3) under the JSON-schema
// type mapper (`src/codegen/connectors/json-schema-types.ts`).
export const SEED_SUBJECTS: readonly SeedSubject[] = [
  {
    // Ecommerce inventory CDC — consumed by the `starter` template.
    topic: "cdc.inventory.products",
    jsonSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        category: { type: "string" },
        price: { type: "number" },
        quantity: { type: "integer" },
      },
    },
    sampleRows: [
      {
        id: 1001,
        name: "Wireless Mouse",
        category: "peripherals",
        price: 29.99,
        quantity: 150,
      },
      {
        id: 1002,
        name: "Mechanical Keyboard",
        category: "peripherals",
        price: 89.99,
        quantity: 80,
      },
      {
        id: 1003,
        name: '27" Monitor',
        category: "displays",
        price: 349.99,
        quantity: 45,
      },
    ],
  },
  {
    // IoT device registry.
    topic: "iot.registry.devices",
    jsonSchema: {
      type: "object",
      properties: {
        device_id: { type: "string" },
        device_name: { type: "string" },
        device_type: { type: "string" },
        location: { type: "string" },
        firmware: { type: "string" },
        status: { type: "string" },
      },
    },
    sampleRows: [
      {
        device_id: "dev-001",
        device_name: "Warehouse-TempSensor-A1",
        device_type: "temperature",
        location: "warehouse-a",
        firmware: "2.1.0",
        status: "active",
      },
      {
        device_id: "dev-003",
        device_name: "Factory-PressureSensor-B1",
        device_type: "pressure",
        location: "factory-b",
        firmware: "2.0.3",
        status: "active",
      },
    ],
  },
  {
    // IoT telemetry stream.
    topic: "iot.telemetry.readings",
    jsonSchema: {
      type: "object",
      properties: {
        device_id: { type: "string" },
        sensor_type: { type: "string" },
        value: { type: "number" },
        unit: { type: "string" },
        reading_time: { type: "string", format: "date-time" },
        location: { type: "string" },
      },
    },
    sampleRows: [
      {
        device_id: "dev-001",
        sensor_type: "temperature",
        value: 22.5,
        unit: "°C",
        reading_time: "2026-01-01 00:00:00.000",
        location: "warehouse-a",
      },
      {
        device_id: "dev-003",
        sensor_type: "pressure",
        value: 1013.2,
        unit: "hPa",
        reading_time: "2026-01-01 00:00:05.000",
        location: "factory-b",
      },
    ],
  },
  {
    // Page-view clickstream — consumed by the `realtime-analytics` template.
    topic: "page-views",
    jsonSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        pageUrl: { type: "string" },
        viewTimestamp: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        userId: "u-1",
        pageUrl: "/home",
        viewTimestamp: "2026-01-01 00:00:00.000",
      },
      {
        userId: "u-2",
        pageUrl: "/products/1001",
        viewTimestamp: "2026-01-01 00:00:01.000",
      },
      {
        userId: "u-1",
        pageUrl: "/cart",
        viewTimestamp: "2026-01-01 00:00:02.000",
      },
    ],
  },
  {
    // Raw, untrusted order events — consumed by the `data-quality` template.
    // `amount`/`quantity` are strings on purpose (the pipeline TRY_CASTs them).
    topic: "orders.raw",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        userId: { type: "string" },
        amount: { type: "string" },
        quantity: { type: "string" },
        currency: { type: "string" },
        status: { type: "string" },
        email: { type: "string" },
        eventTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: "o-1",
        userId: "u-1",
        amount: "29.99",
        quantity: "2",
        currency: "USD",
        status: "placed",
        email: "a@example.com",
        eventTime: "2026-01-01 00:00:00.000",
      },
      {
        orderId: "o-2",
        userId: "u-2",
        amount: "89.99",
        quantity: "1",
        currency: "",
        status: "placed",
        email: "b@example.com",
        eventTime: "2026-01-01 00:00:01.000",
      },
    ],
  },
  {
    // Debezium orders CDC — consumed by the `cdc-lakehouse` template.
    // `amount` is DECIMAL(10,2) in the shipped schema; JSON Schema has no
    // decimal, so it registers as `number` and regenerates as DOUBLE.
    topic: "dbserver1.inventory.orders",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "integer" },
        customerId: { type: "integer" },
        product: { type: "string" },
        amount: { type: "number" },
        status: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: 5001,
        customerId: 42,
        product: "Wireless Mouse",
        amount: 29.99,
        status: "PENDING",
        createdAt: "2026-01-01 09:15:00.000",
        updatedAt: "2026-01-01 09:15:00.000",
      },
      {
        orderId: 5002,
        customerId: 108,
        product: "Mechanical Keyboard",
        amount: 89.99,
        status: "SHIPPED",
        createdAt: "2026-01-01 09:16:30.000",
        updatedAt: "2026-01-01 10:02:00.000",
      },
    ],
  },
  {
    // Ecommerce orders — consumed by the `ecommerce` template (source `orders`).
    topic: "ecom.orders",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        customerId: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
        status: { type: "string" },
        orderTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: "ord-1",
        customerId: "cust-1",
        amount: 129.99,
        currency: "USD",
        status: "placed",
        orderTime: "2026-01-01 00:00:00.000",
      },
      {
        orderId: "ord-2",
        customerId: "cust-2",
        amount: 599.0,
        currency: "USD",
        status: "placed",
        orderTime: "2026-01-01 00:00:02.000",
      },
    ],
  },
  {
    // Ecommerce order line-items — `ecommerce` template (source `order-items`).
    topic: "ecom.order-items",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        productId: { type: "string" },
        quantity: { type: "integer" },
        unitPrice: { type: "number" },
        itemTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: "ord-1",
        productId: "prod-1",
        quantity: 2,
        unitPrice: 29.99,
        itemTime: "2026-01-01 00:00:00.000",
      },
      {
        orderId: "ord-1",
        productId: "prod-2",
        quantity: 1,
        unitPrice: 69.99,
        itemTime: "2026-01-01 00:00:00.000",
      },
    ],
  },
  {
    // Ecommerce product CDC — `ecommerce` template (source `products`).
    topic: "ecom.products",
    jsonSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        name: { type: "string" },
        category: { type: "string" },
        price: { type: "number" },
        stock: { type: "integer" },
        updateTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        productId: "prod-1",
        name: "Wireless Mouse",
        category: "peripherals",
        price: 29.99,
        stock: 150,
        updateTime: "2026-01-01 00:00:00.000",
      },
      {
        productId: "prod-2",
        name: "USB-C Hub",
        category: "accessories",
        price: 69.99,
        stock: 200,
        updateTime: "2026-01-01 00:00:01.000",
      },
    ],
  },
  {
    // Bank transactions — consumed by the `banking` template (source `transactions`).
    topic: "bank.transactions",
    jsonSchema: {
      type: "object",
      properties: {
        txnId: { type: "string" },
        accountId: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
        merchant: { type: "string" },
        country: { type: "string" },
        txnTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        txnId: "txn-1001",
        accountId: "acct-42",
        amount: 1499.95,
        currency: "USD",
        merchant: "SkyMart",
        country: "US",
        txnTime: "2026-07-10 09:15:22.000",
      },
      {
        txnId: "txn-1003",
        accountId: "acct-88",
        amount: 42.1,
        currency: "EUR",
        merchant: "CafeBleu",
        country: "FR",
        txnTime: "2026-07-10 09:17:41.000",
      },
    ],
  },
  {
    // Bank accounts CDC dimension — `banking` template (source `accounts`).
    topic: "bank.accounts",
    jsonSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        name: { type: "string" },
        tier: { type: "string" },
        status: { type: "string" },
        balance: { type: "number" },
        updateTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        accountId: "acct-42",
        name: "Ada Lovelace",
        tier: "platinum",
        status: "active",
        balance: 18234.55,
        updateTime: "2026-07-10 08:00:00.000",
      },
      {
        accountId: "acct-88",
        name: "Grace Hopper",
        tier: "gold",
        status: "active",
        balance: 5120.0,
        updateTime: "2026-07-10 08:05:12.000",
      },
    ],
  },
  {
    // Medallion CDC orders — `lakehouse-analytics` template (source `medallion`).
    topic: "orders.cdc",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        customerId: { type: "string" },
        product: { type: "string" },
        amount: { type: "number" },
        status: { type: "string" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: "ord-1001",
        customerId: "cust-42",
        product: "Wireless Mouse",
        amount: 29.99,
        status: "PLACED",
        updatedAt: "2026-01-01 00:00:00.000",
      },
      {
        orderId: "ord-1002",
        customerId: "cust-07",
        product: "Mechanical Keyboard",
        amount: 89.99,
        status: "SHIPPED",
        updatedAt: "2026-01-01 00:00:05.000",
      },
    ],
  },
  {
    // Ride requests — `ride-sharing` template (source `requests`).
    topic: "rides.requests",
    jsonSchema: {
      type: "object",
      properties: {
        rideId: { type: "string" },
        riderId: { type: "string" },
        zoneId: { type: "string" },
        pickupLat: { type: "number" },
        pickupLng: { type: "number" },
        dropoffLat: { type: "number" },
        dropoffLng: { type: "number" },
        requestTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        rideId: "r-1001",
        riderId: "u-42",
        zoneId: "z-downtown",
        pickupLat: 37.7749,
        pickupLng: -122.4194,
        dropoffLat: 37.7849,
        dropoffLng: -122.4094,
        requestTime: "2026-01-01 00:00:00.000",
      },
      {
        rideId: "r-1002",
        riderId: "u-77",
        zoneId: "z-mission",
        pickupLat: 37.7599,
        pickupLng: -122.4148,
        dropoffLat: 37.7935,
        dropoffLng: -122.397,
        requestTime: "2026-01-01 00:00:03.000",
      },
    ],
  },
  {
    // Ride trip-status events — `ride-sharing` template (source `trip-events`).
    topic: "rides.trip-events",
    jsonSchema: {
      type: "object",
      properties: {
        rideId: { type: "string" },
        driverId: { type: "string" },
        status: { type: "string" },
        eventTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        rideId: "r-1001",
        driverId: "d-9",
        status: "accepted",
        eventTime: "2026-01-01 00:00:05.000",
      },
      {
        rideId: "r-1001",
        driverId: "d-9",
        status: "pickup",
        eventTime: "2026-01-01 00:02:00.000",
      },
    ],
  },
  {
    // Surge-zone CDC dimension — `ride-sharing` template (source `surge-zones`).
    topic: "rides.surge-zones",
    jsonSchema: {
      type: "object",
      properties: {
        zoneId: { type: "string" },
        baseMultiplier: { type: "number" },
        updateTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        zoneId: "z-downtown",
        baseMultiplier: 1.5,
        updateTime: "2026-01-01 00:00:00.000",
      },
      {
        zoneId: "z-mission",
        baseMultiplier: 1.2,
        updateTime: "2026-01-01 00:00:00.000",
      },
    ],
  },
  {
    // IoT sensor telemetry — `iot-factory` template (source `sensor-readings`).
    topic: "iot.sensor-readings",
    jsonSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string" },
        sensorType: { type: "string" },
        value: { type: "number" },
        unit: { type: "string" },
        readingTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        deviceId: "pump-01",
        sensorType: "vibration",
        value: 3.42,
        unit: "mm/s",
        readingTime: "2026-07-10 09:15:00.000",
      },
      {
        deviceId: "pump-02",
        sensorType: "temperature",
        value: 71.8,
        unit: "C",
        readingTime: "2026-07-10 09:15:05.000",
      },
    ],
  },
  {
    // Grocery order lines — `grocery-delivery` template (source `order-lines`).
    topic: "grocery.order-lines",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        storeId: { type: "string" },
        productId: { type: "string" },
        quantity: { type: "integer" },
        lineTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: "o-1001",
        storeId: "s-01",
        productId: "p-apple",
        quantity: 3,
        lineTime: "2026-07-10 09:15:00.000",
      },
      {
        orderId: "o-1002",
        storeId: "s-02",
        productId: "p-bread",
        quantity: 2,
        lineTime: "2026-07-10 09:16:30.000",
      },
    ],
  },
  {
    // Grocery store inventory CDC — `grocery-delivery` template (source `store-inventory`).
    topic: "grocery.store-inventory",
    jsonSchema: {
      type: "object",
      properties: {
        storeId: { type: "string" },
        productId: { type: "string" },
        stockLevel: { type: "integer" },
        substitutionId: { type: "string" },
        updateTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        storeId: "s-01",
        productId: "p-apple",
        stockLevel: 42,
        substitutionId: "p-apple-organic",
        updateTime: "2026-07-10 09:10:00.000",
      },
      {
        storeId: "s-01",
        productId: "p-milk",
        stockLevel: 0,
        substitutionId: "p-milk-oat",
        updateTime: "2026-07-10 09:12:00.000",
      },
    ],
  },
  {
    // Grocery delivery ratings — `grocery-delivery` template (source `ratings`).
    topic: "grocery.ratings",
    jsonSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        storeId: { type: "string" },
        shopperRating: { type: "number" },
        storeRating: { type: "number" },
        itemQuality: { type: "number" },
        ratingTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        orderId: "o-1001",
        storeId: "s-01",
        shopperRating: 4.8,
        storeRating: 4.5,
        itemQuality: 4.7,
        ratingTime: "2026-07-10 10:05:00.000",
      },
      {
        orderId: "o-1002",
        storeId: "s-02",
        shopperRating: 3.9,
        storeRating: 4.1,
        itemQuality: 3.5,
        ratingTime: "2026-07-10 10:07:20.000",
      },
    ],
  },
  {
    // Lakehouse raw events — `lakehouse-ingestion` template (source `events`).
    topic: "lake.events",
    jsonSchema: {
      type: "object",
      properties: {
        eventId: { type: "string" },
        userId: { type: "string" },
        eventType: { type: "string" },
        payload: { type: "string" },
        eventTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        eventId: "evt-0001",
        userId: "u-1001",
        eventType: "page_view",
        payload: '{"path":"/home"}',
        eventTime: "2026-01-01 00:00:00.000",
      },
      {
        eventId: "evt-0002",
        userId: "u-1002",
        eventType: "add_to_cart",
        payload: '{"sku":"1001","qty":2}',
        eventTime: "2026-01-01 00:00:01.500",
      },
    ],
  },
  {
    // Lakehouse clickstream — `lakehouse-ingestion` template (source `clickstream`).
    topic: "lake.clickstream",
    jsonSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        userId: { type: "string" },
        pageUrl: { type: "string" },
        referrer: { type: "string" },
        userAgent: { type: "string" },
        clickTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        sessionId: "sess-abc123",
        userId: "u-1001",
        pageUrl: "/home",
        referrer: "https://google.com",
        userAgent: "Mozilla/5.0",
        clickTime: "2026-01-01 00:00:00.000",
      },
      {
        sessionId: "sess-def456",
        userId: "u-1002",
        pageUrl: "/cart",
        referrer: "/products/1001",
        userAgent: "Mozilla/5.0",
        clickTime: "2026-01-01 00:00:06.750",
      },
    ],
  },
  {
    // Lakehouse transactions — `lakehouse-ingestion` template (source `transactions`).
    topic: "lake.transactions",
    jsonSchema: {
      type: "object",
      properties: {
        txnId: { type: "string" },
        accountId: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
        txnType: { type: "string" },
        txnTime: { type: "string", format: "date-time" },
      },
    },
    sampleRows: [
      {
        txnId: "txn-5001",
        accountId: "acct-42",
        amount: 129.99,
        currency: "USD",
        txnType: "purchase",
        txnTime: "2026-01-01 00:00:00.000",
      },
      {
        txnId: "txn-5002",
        accountId: "acct-88",
        amount: 2500.0,
        currency: "EUR",
        txnType: "transfer",
        txnTime: "2026-01-01 00:00:02.100",
      },
    ],
  },
]

/** Resolve a subject name, defaulting to Confluent TopicNameStrategy. */
export function subjectFor(entry: SeedSubject): string {
  return entry.subject ?? `${entry.topic}-value`
}

/** POST body Karapace/Confluent expects when registering a JSON Schema. */
export function registerBody(entry: SeedSubject): string {
  return JSON.stringify({
    schemaType: "JSON",
    schema: JSON.stringify(entry.jsonSchema),
  })
}

export interface RegisterResult {
  readonly registered: string[]
  readonly failed: string[]
}

/**
 * Register the seed row schemas against a running Schema Registry over HTTP.
 *
 * Idempotent — re-registering an identical schema is a no-op the registry
 * dedupes. Never throws: a registry that's down or rejects a subject is
 * logged and reported in `failed`, because schema seeding must not abort the
 * broader `cluster up` / `seed` flow. Runs on the host, so it targets the
 * published host port (default `LOCAL_SCHEMA_REGISTRY_URL`).
 */
export async function registerSeedSchemas(opts?: {
  registryUrl?: string
  /** Restrict to these topics; defaults to every entry in SEED_SUBJECTS. */
  topics?: readonly string[]
  subjects?: readonly SeedSubject[]
  fetchImpl?: typeof fetch
}): Promise<RegisterResult> {
  const registryUrl = opts?.registryUrl ?? LOCAL_SCHEMA_REGISTRY_URL
  const doFetch = opts?.fetchImpl ?? fetch
  const source = opts?.subjects ?? SEED_SUBJECTS
  const entries = opts?.topics
    ? source.filter((e) => opts.topics?.includes(e.topic))
    : source

  const registered: string[] = []
  const failed: string[] = []

  for (const entry of entries) {
    const subject = subjectFor(entry)
    const url = `${registryUrl}/subjects/${encodeURIComponent(subject)}/versions`
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": REGISTRY_CONTENT_TYPE,
          Accept: REGISTRY_CONTENT_TYPE,
        },
        body: registerBody(entry),
      })
      if (res.ok) {
        registered.push(subject)
      } else {
        failed.push(subject)
      }
    } catch {
      failed.push(subject)
    }
  }

  if (registered.length > 0) {
    console.log(
      `  ${pc.green("✓")} Registered ${registered.length} schema subject(s) with the registry`,
    )
  }
  if (failed.length > 0) {
    console.log(
      pc.yellow(
        `  Could not register ${failed.length} subject(s): ${failed.join(", ")} (registry not ready?)`,
      ),
    )
  }

  return { registered, failed }
}
