// ── Sandbox Examples ────────────────────────────────────────────────
// Categorized DSL examples for the Storybook-style sidebar.
// Code is written without imports — the synthesizer injects all DSL
// exports (Pipeline, KafkaSource, Filter, Schema, Field, etc.)
// as scope variables via new Function().

export interface SandboxExample {
  id: string
  name: string
  description: string
  code: string
}

export interface SandboxCategory {
  id: string
  name: string
  examples: SandboxExample[]
}

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

// Flat lookup helpers
export function findExample(id: string): SandboxExample | undefined {
  for (const category of SANDBOX_CATEGORIES) {
    const example = category.examples.find((e) => e.id === id)
    if (example) return example
  }
  return undefined
}

export const DEFAULT_EXAMPLE_ID = "hello-world"
