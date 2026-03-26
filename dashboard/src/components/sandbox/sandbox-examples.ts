/**
 * Categorized DSL examples for the Storybook-style sandbox sidebar.
 * Code is written without imports — the synthesizer injects all DSL exports
 * (Pipeline, KafkaSource, Filter, Schema, Field, etc.) as scope variables
 * via `new Function()`.
 */

/** A single sandbox example with metadata and DSL source code. */
export interface SandboxExample {
  /** Unique identifier used for lookup and URL routing. */
  id: string
  /** Human-readable name shown in the sidebar. */
  name: string
  /** Short description of what the example demonstrates. */
  description: string
  /** Raw TSX code (no imports) — executed via the sandbox synthesizer. */
  code: string
  /** JSX tag names to keep bright (everything else dimmed) — Transform examples only. */
  focusComponents?: string[]
}

/** A group of related examples under a common heading. */
export interface SandboxCategory {
  /** Unique category identifier. */
  id: string
  /** Display name for the category header. */
  name: string
  /** Ordered list of examples within this category. */
  examples: SandboxExample[]
}

/**
 * All sandbox example categories, ordered for sidebar display.
 * Categories: Getting Started, Transforms, Windows, Joins, Routing.
 */
export const SANDBOX_CATEGORIES: SandboxCategory[] = [
  // ── Getting Started ───────────────────────────────────────────────
  {
    id: "getting-started",
    name: "Getting Started",
    examples: [
      {
        id: "hello-world",
        name: "Hello World",
        description: "Simplest pipeline: read from Kafka, write to Kafka",
        code: `const EventSchema = Schema({
  fields: {
    event_id: Field.STRING(),
    user_id: Field.STRING(),
    event_type: Field.STRING(),
    payload: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
})

<Pipeline name="simple-source-sink" parallelism={4}>
  <KafkaSource
    topic="user_events"
    bootstrapServers="kafka:9092"
    schema={EventSchema}
  />
  <KafkaSink topic="user_events_processed" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "filter-and-project",
        name: "Filter & Project",
        description: "Filter rows and select specific columns",
        code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    user_id: Field.STRING(),
    product_id: Field.STRING(),
    amount: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
  },
})

<Pipeline name="filter-project" parallelism={8}>
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
  <Filter condition="amount > 100" />
  <Map
    select={{
      order_id: "order_id",
      user_id: "user_id",
      amount: "amount",
      order_time: "order_time",
    }}
  />
  <GenericSink connector="print" />
</Pipeline>`,
      },
    ],
  },

  // ── Transforms ────────────────────────────────────────────────────
  {
    id: "transforms",
    name: "Transforms",
    examples: [
      {
        id: "group-aggregate",
        name: "Group Aggregate",
        description: "Continuous aggregation with GROUP BY",
        focusComponents: ["Aggregate"],

        code: `const TransactionSchema = Schema({
  fields: {
    user_id: Field.STRING(),
    amount: Field.DECIMAL(10, 2),
    transaction_time: Field.TIMESTAMP(3),
    category: Field.STRING(),
  },
  watermark: {
    column: "transaction_time",
    expression: "transaction_time - INTERVAL '5' SECOND",
  },
})

<Pipeline name="user-totals" parallelism={8}>
  <KafkaSource
    topic="transactions"
    bootstrapServers="kafka:9092"
    schema={TransactionSchema}
  />
  <Aggregate
    groupBy={["user_id"]}
    select={{
      user_id: "user_id",
      total_amount: "SUM(amount)",
      txn_count: "COUNT(*)",
    }}
  />
  <JdbcSink
    url="jdbc:postgresql://db:5432/analytics"
    table="user_totals"
  />
</Pipeline>`,
      },
      {
        id: "dedup-aggregate",
        name: "Deduplicate + Aggregate",
        description: "Remove duplicates then aggregate by window",
        focusComponents: ["Deduplicate", "Aggregate"],
        code: `const RawEventSchema = Schema({
  fields: {
    event_id: Field.STRING(),
    user_id: Field.STRING(),
    event_type: Field.STRING(),
    event_data: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '5' SECOND",
  },
})

<Pipeline name="hourly-user-events" parallelism={16}>
  <KafkaSource
    topic="raw_events"
    bootstrapServers="kafka:9092"
    schema={RawEventSchema}
  />
  <Deduplicate key={["event_id"]} order="event_time" keep="first" />
  <TumbleWindow size="1 hour" on="event_time">
    <Aggregate
      groupBy={["user_id", "event_type"]}
      select={{
        user_id: "user_id",
        event_type: "event_type",
        event_count: "COUNT(*)",
      }}
    />
  </TumbleWindow>
  <KafkaSink topic="hourly_user_events" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "flatmap-unnest",
        name: "Flatten Nested Data",
        description: "Unnest an array column into individual rows with FlatMap",
        focusComponents: ["FlatMap"],
        code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.STRING(),
    customer_id: Field.STRING(),
    line_items: Field.ARRAY(Field.STRING()),
    order_time: Field.TIMESTAMP(3),
  },
})

<Pipeline name="unnest-line-items" parallelism={4}>
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
  <FlatMap
    unnest="line_items"
    as={{
      product_id: "STRING",
      quantity: "INT",
      price: "DECIMAL(10, 2)",
    }}
  />
  <KafkaSink topic="order_line_items" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "top-n-ranking",
        name: "Top N Ranking",
        description: "Rank top 3 products per category by revenue",
        focusComponents: ["TopN", "Aggregate"],
        code: `const SalesSchema = Schema({
  fields: {
    product_id: Field.STRING(),
    category: Field.STRING(),
    revenue: Field.DECIMAL(10, 2),
    sale_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "sale_time",
    expression: "sale_time - INTERVAL '5' SECOND",
  },
})

<Pipeline name="top-products-by-category" parallelism={8}>
  <KafkaSource
    topic="sales"
    bootstrapServers="kafka:9092"
    schema={SalesSchema}
  />
  <Aggregate
    groupBy={["category", "product_id"]}
    select={{
      category: "category",
      product_id: "product_id",
      total_revenue: "SUM(revenue)",
    }}
  />
  <TopN
    partitionBy={["category"]}
    orderBy={{ total_revenue: "DESC" }}
    n={3}
  />
  <KafkaSink topic="top_products" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "union-streams",
        name: "Merge Streams",
        description: "Combine same-schema event streams from multiple regions",
        focusComponents: ["Union"],
        code: `const RegionalEventSchema = Schema({
  fields: {
    event_id: Field.STRING(),
    user_id: Field.STRING(),
    event_type: Field.STRING(),
    region: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
})

const us = (
  <KafkaSource
    topic="events_us"
    bootstrapServers="kafka-us:9092"
    schema={RegionalEventSchema}
  />
)

const eu = (
  <KafkaSource
    topic="events_eu"
    bootstrapServers="kafka-eu:9092"
    schema={RegionalEventSchema}
  />
)

<Pipeline name="merged-regional-events" parallelism={8}>
  <Union>{us}{eu}</Union>
  <KafkaSink topic="events_global" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "rename-fields",
        name: "Rename Fields",
        description:
          "Standardize legacy column names to consistent conventions",
        focusComponents: ["Rename"],
        code: `const LegacySchema = Schema({
  fields: {
    usr_id: Field.STRING(),
    evt_type: Field.STRING(),
    ts: Field.TIMESTAMP(3),
    payload: Field.STRING(),
  },
})

<Pipeline name="standardize-columns" parallelism={4}>
  <KafkaSource
    topic="legacy_events"
    bootstrapServers="kafka:9092"
    schema={LegacySchema}
  />
  <Rename
    columns={{
      usr_id: "user_id",
      evt_type: "event_type",
      ts: "event_time",
    }}
  />
  <KafkaSink topic="standardized_events" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "drop-fields",
        name: "Drop Fields",
        description:
          "Strip internal fields before publishing to an external topic",
        focusComponents: ["Drop"],
        code: `const InternalEventSchema = Schema({
  fields: {
    event_id: Field.STRING(),
    user_id: Field.STRING(),
    event_type: Field.STRING(),
    internal_trace_id: Field.STRING(),
    debug_flags: Field.STRING(),
    raw_payload: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
})

<Pipeline name="strip-internal-fields" parallelism={4}>
  <KafkaSource
    topic="internal_events"
    bootstrapServers="kafka:9092"
    schema={InternalEventSchema}
  />
  <Drop columns={["internal_trace_id", "debug_flags", "raw_payload"]} />
  <KafkaSink topic="public_events" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "cast-types",
        name: "Cast Types",
        description: "Convert string-encoded sensor readings to numeric types",
        focusComponents: ["Cast"],
        code: `const RawSensorSchema = Schema({
  fields: {
    sensor_id: Field.STRING(),
    temperature: Field.STRING(),
    humidity: Field.STRING(),
    reading_time: Field.STRING(),
  },
})

<Pipeline name="cast-sensor-readings" parallelism={4}>
  <KafkaSource
    topic="raw_sensor_data"
    bootstrapServers="kafka:9092"
    schema={RawSensorSchema}
  />
  <Cast
    columns={{
      temperature: "DOUBLE",
      humidity: "DOUBLE",
      reading_time: "TIMESTAMP(3)",
    }}
    safe={true}
  />
  <KafkaSink topic="typed_sensor_data" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "coalesce-defaults",
        name: "Coalesce Defaults",
        description: "Fill nullable user profile fields with sensible defaults",
        focusComponents: ["Coalesce"],
        code: `const UserProfileSchema = Schema({
  fields: {
    user_id: Field.STRING(),
    display_name: Field.STRING(),
    locale: Field.STRING(),
    timezone: Field.STRING(),
    updated_at: Field.TIMESTAMP(3),
  },
})

<Pipeline name="fill-profile-defaults" parallelism={4}>
  <KafkaSource
    topic="user_profiles"
    bootstrapServers="kafka:9092"
    schema={UserProfileSchema}
  />
  <Coalesce
    columns={{
      display_name: "user_id",
      locale: "'en-US'",
      timezone: "'UTC'",
    }}
  />
  <KafkaSink topic="enriched_profiles" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "add-computed-field",
        name: "Add Computed Field",
        description: "Enrich orders with computed total and high-value flag",
        focusComponents: ["AddField"],
        code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.STRING(),
    product_id: Field.STRING(),
    quantity: Field.INT(),
    unit_price: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
  },
})

<Pipeline name="enrich-orders" parallelism={8}>
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
  <AddField
    columns={{
      total_price: "quantity * unit_price",
      is_high_value: "quantity * unit_price > 500",
    }}
  />
  <KafkaSink topic="enriched_orders" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
    ],
  },

  // ── Windows ───────────────────────────────────────────────────────
  {
    id: "windows",
    name: "Windows",
    examples: [
      {
        id: "tumble-window",
        name: "Tumble Window",
        description: "Fixed-size windows for per-minute active user counts",
        code: `const ClickstreamSchema = Schema({
  fields: {
    user_id: Field.STRING(),
    page_url: Field.STRING(),
    session_id: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '10' SECOND",
  },
})

<Pipeline name="active-users-per-minute" parallelism={12}>
  <KafkaSource
    topic="clickstream"
    bootstrapServers="kafka:9092"
    schema={ClickstreamSchema}
  />
  <TumbleWindow size="1 minute" on="event_time">
    <Aggregate
      groupBy={["user_id"]}
      select={{
        user_id: "user_id",
        page_views: "COUNT(*)",
        unique_pages: "COUNT(DISTINCT page_url)",
      }}
    />
  </TumbleWindow>
  <Filter condition="page_views > 5" />
  <KafkaSink topic="active_users_per_minute" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
    ],
  },

  // ── Joins ─────────────────────────────────────────────────────────
  {
    id: "joins",
    name: "Joins",
    examples: [
      {
        id: "interval-join",
        name: "Interval Join",
        description: "Join orders with shipments within a 7-day window",
        code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.STRING(),
    user_id: Field.STRING(),
    product_id: Field.STRING(),
    amount: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "order_time",
    expression: "order_time - INTERVAL '10' SECOND",
  },
})

const ShipmentSchema = Schema({
  fields: {
    shipment_id: Field.STRING(),
    order_id: Field.STRING(),
    carrier: Field.STRING(),
    ship_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "ship_time",
    expression: "ship_time - INTERVAL '10' SECOND",
  },
})

const orders = (
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
)

const shipments = (
  <KafkaSource
    topic="shipments"
    bootstrapServers="kafka:9092"
    schema={ShipmentSchema}
  />
)

<Pipeline name="order-fulfillment" parallelism={8}>
  <IntervalJoin
    left={orders}
    right={shipments}
    on="order_id = order_id"
    interval={{
      from: "order_time",
      to: "order_time + INTERVAL '7' DAY",
    }}
  />
  <Map
    select={{
      order_id: "order_id",
      user_id: "user_id",
      amount: "amount",
      carrier: "carrier",
      fulfillment_time: "ship_time - order_time",
    }}
  />
  <KafkaSink topic="order_fulfillment" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
      {
        id: "lookup-join",
        name: "Lookup Join",
        description: "Enrich a stream with dimension data from a database",
        code: `const ActionSchema = Schema({
  fields: {
    action_id: Field.STRING(),
    user_id: Field.STRING(),
    action_type: Field.STRING(),
    action_time: Field.TIMESTAMP(3),
    metadata: Field.STRING(),
  },
})

const actions = (
  <KafkaSource
    topic="user_actions"
    bootstrapServers="kafka:9092"
    schema={ActionSchema}
  />
)

<Pipeline name="premium-user-enrichment" parallelism={16}>
  <LookupJoin
    input={actions}
    table="user_profiles"
    url="jdbc:mysql://db:3306/users"
    on="user_id"
    async={{ enabled: true, capacity: 100, timeout: "30s" }}
    cache={{ type: "lru", maxRows: 10000, ttl: "1m" }}
  />
  <Filter condition="user_tier IN ('premium', 'enterprise')" />
  <KafkaSink topic="premium_user_actions" bootstrapServers="kafka:9092" />
</Pipeline>`,
      },
    ],
  },

  // ── Routing ───────────────────────────────────────────────────────
  {
    id: "routing",
    name: "Routing",
    examples: [
      {
        id: "branching-multi-sink",
        name: "Branching & Multi-Sink",
        description: "Route orders to different sinks based on conditions",
        code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.STRING(),
    customer_id: Field.STRING(),
    product_id: Field.STRING(),
    quantity: Field.INT(),
    unit_price: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
    region: Field.STRING(),
    order_status: Field.STRING(),
  },
  watermark: {
    column: "order_time",
    expression: "order_time - INTERVAL '10' SECOND",
  },
})

<Pipeline name="order-routing" parallelism={16}>
  <KafkaSource
    topic="raw_orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
  <Map
    select={{
      order_id: "order_id",
      customer_id: "customer_id",
      product_id: "product_id",
      total_amount: "quantity * unit_price",
      order_time: "order_time",
      region: "region",
      order_status: "order_status",
    }}
  />
  <Route>
    <Route.Branch condition="total_amount >= 1000">
      <KafkaSink topic="high_value_orders" bootstrapServers="kafka:9092" />
    </Route.Branch>
    <Route.Branch condition="order_status = 'FAILED'">
      <KafkaSink topic="failed_orders_alerts" bootstrapServers="kafka:9092" />
    </Route.Branch>
    <Route.Default>
      <TumbleWindow size="1 minute" on="order_time">
        <Aggregate
          groupBy={["region"]}
          select={{
            region: "region",
            revenue: "SUM(total_amount)",
            order_count: "COUNT(*)",
          }}
        />
      </TumbleWindow>
      <JdbcSink
        url="jdbc:postgresql://db:5432/analytics"
        table="regional_metrics_per_minute"
      />
    </Route.Default>
  </Route>
</Pipeline>`,
      },
    ],
  },
]

/**
 * Find an example by ID across all categories.
 * @param id - The example identifier to search for.
 * @returns The matching example, or `undefined` if not found.
 */
export function findExample(id: string): SandboxExample | undefined {
  for (const category of SANDBOX_CATEGORIES) {
    const example = category.examples.find((e) => e.id === id)
    if (example) return example
  }
  return undefined
}

/**
 * Find the category ID that contains a given example.
 * @param id - The example identifier to search for.
 * @returns The parent category ID, or `null` if not found.
 */
export function findCategoryForExample(id: string): string | null {
  for (const cat of SANDBOX_CATEGORIES) {
    if (cat.examples.some((e) => e.id === id)) return cat.id
  }
  return null
}

/** The example loaded when the sandbox opens with no selection. */
export const DEFAULT_EXAMPLE_ID = "hello-world"
