// ── Sandbox Pipeline Templates ─────────────────────────────────────
// Starter templates covering common Flink pipeline patterns.
// Code is bare TSX (no imports) — the sandbox synthesizer injects
// all DSL exports as scope variables.

export type TemplateId =
  | "kafka-filter"
  | "jdbc-to-kafka"
  | "kafka-map"
  | "join-pipeline"
  | "windowed-aggregation"

export interface TemplateDefinition {
  id: TemplateId
  name: string
  description: string
  code: string
}

export const TEMPLATES: TemplateDefinition[] = [
  // ── Kafka Filter (default) ──────────────────────────────────────
  {
    id: "kafka-filter",
    name: "Kafka Filter",
    description: "Filter events from a Kafka topic and write to another",
    code: `const EventSchema = Schema({
  fields: {
    id: Field.STRING(),
    name: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '5' SECOND",
  },
})

<Pipeline name="kafka-filter" parallelism={4}>
  <KafkaSource
    topic="events"
    bootstrapServers="kafka:9092"
    schema={EventSchema}
  />
  <Filter condition="name IS NOT NULL" />
  <KafkaSink topic="filtered_events" bootstrapServers="kafka:9092" />
</Pipeline>`,
  },

  // ── JDBC to Kafka ───────────────────────────────────────────────
  {
    id: "jdbc-to-kafka",
    name: "JDBC to Kafka",
    description: "Stream rows from a database table to a Kafka topic",
    code: `const UserSchema = Schema({
  fields: {
    user_id: Field.BIGINT(),
    username: Field.STRING(),
    email: Field.STRING(),
    created_at: Field.TIMESTAMP(3),
  },
})

<Pipeline name="jdbc-to-kafka" parallelism={2}>
  <JdbcSource
    url="jdbc:postgresql://db:5432/app"
    table="users"
    schema={UserSchema}
  />
  <KafkaSink topic="user_changes" bootstrapServers="kafka:9092" />
</Pipeline>`,
  },

  // ── Kafka Map Transform ─────────────────────────────────────────
  {
    id: "kafka-map",
    name: "Kafka Map Transform",
    description: "Project and transform fields from a Kafka stream",
    code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.STRING(),
    customer_id: Field.STRING(),
    quantity: Field.INT(),
    unit_price: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
  },
})

<Pipeline name="kafka-map" parallelism={4}>
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
  <Map
    select={{
      order_id: "order_id",
      customer_id: "customer_id",
      total_amount: "quantity * unit_price",
      order_time: "order_time",
    }}
  />
  <KafkaSink topic="enriched_orders" bootstrapServers="kafka:9092" />
</Pipeline>`,
  },

  // ── Join Pipeline ───────────────────────────────────────────────
  {
    id: "join-pipeline",
    name: "Join Pipeline",
    description: "Join two Kafka streams on a shared key",
    code: `const OrderSchema = Schema({
  fields: {
    order_id: Field.STRING(),
    user_id: Field.STRING(),
    amount: Field.DECIMAL(10, 2),
    order_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "order_time",
    expression: "order_time - INTERVAL '10' SECOND",
  },
})

const PaymentSchema = Schema({
  fields: {
    payment_id: Field.STRING(),
    order_id: Field.STRING(),
    status: Field.STRING(),
    paid_at: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "paid_at",
    expression: "paid_at - INTERVAL '10' SECOND",
  },
})

const orders = (
  <KafkaSource
    topic="orders"
    bootstrapServers="kafka:9092"
    schema={OrderSchema}
  />
)

const payments = (
  <KafkaSource
    topic="payments"
    bootstrapServers="kafka:9092"
    schema={PaymentSchema}
  />
)

<Pipeline name="order-payment-join" parallelism={8}>
  <Join
    left={orders}
    right={payments}
    on="order_id = order_id"
    type="inner"
  />
  <KafkaSink topic="joined_orders" bootstrapServers="kafka:9092" />
</Pipeline>`,
  },

  // ── Windowed Aggregation ────────────────────────────────────────
  {
    id: "windowed-aggregation",
    name: "Windowed Aggregation",
    description: "Tumbling window aggregation over a Kafka stream",
    code: `const ClickSchema = Schema({
  fields: {
    user_id: Field.STRING(),
    page_url: Field.STRING(),
    event_time: Field.TIMESTAMP(3),
  },
  watermark: {
    column: "event_time",
    expression: "event_time - INTERVAL '5' SECOND",
  },
})

<Pipeline name="clicks-per-minute" parallelism={4}>
  <KafkaSource
    topic="clickstream"
    bootstrapServers="kafka:9092"
    schema={ClickSchema}
  />
  <TumbleWindow size="1 minute" on="event_time">
    <Aggregate
      groupBy={["user_id"]}
      select={{
        user_id: "user_id",
        click_count: "COUNT(*)",
        unique_pages: "COUNT(DISTINCT page_url)",
      }}
    />
  </TumbleWindow>
  <KafkaSink topic="user_clicks_per_minute" bootstrapServers="kafka:9092" />
</Pipeline>`,
  },
]

export const DEFAULT_TEMPLATE_ID: TemplateId = "kafka-filter"

export function findTemplate(id: TemplateId): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
