import type { ScaffoldOptions, TemplateFile } from "@/cli/commands/new.js"
import {
  pipelineReadme,
  sharedFiles,
  templatePipelineTestStub,
  templateReadme,
} from "./shared.js"

export function getEcommerceTemplates(opts: ScaffoldOptions): TemplateFile[] {
  return [
    ...sharedFiles(opts),
    {
      path: "flink-reactor.config.ts",
      content: `import { defineConfig } from '@flink-reactor/dsl';

export default defineConfig({
  flink: { version: '${opts.flinkVersion}' },

  // Kafka for events; Postgres for the JDBC dim/fact sinks the pipelines write to.
  // \`schemaRegistryUrl\` is read by \`fr schema generate\` (host port of the
  // bundled registry), not by the runtime connectors.
  services: { kafka: { bootstrapServers: 'kafka:9092', schemaRegistryUrl: 'http://localhost:8082' }, postgres: {} },

  // \`sources\` powers \`fr schema generate\` for the three external Kafka input
  // topics. The derived \`ecom.order-enriched\` topic and the JDBC customers
  // dimension (\`flink_sink.customers\`, not seeded locally) are intentionally
  // not wired as sources.
  sources: {
    orders: { type: 'kafka', topic: 'ecom.orders' },
    'order-items': { type: 'kafka', topic: 'ecom.order-items' },
    products: { type: 'kafka', topic: 'ecom.products' },
  },

  environments: {
    minikube: {
      cluster: { url: 'http://localhost:8081' },
      sim: {
        init: {
          kafka: {
            topics: ['ecom.orders', 'ecom.order-items', 'ecom.products', 'ecom.order-enriched', 'ecom.revenue-alerts'],
            catalogs: [{
              name: 'ecom',
              tables: [
                {
                  table: 'orders',
                  topic: 'ecom.orders',
                  format: 'json',
                  columns: {
                    orderId: 'STRING',
                    customerId: 'STRING',
                    amount: 'DOUBLE',
                    currency: 'STRING',
                    status: 'STRING',
                    orderTime: 'TIMESTAMP(3)',
                  },
                  watermark: { column: 'orderTime', expression: "orderTime - INTERVAL '5' SECOND" },
                },
                {
                  table: 'order_items',
                  topic: 'ecom.order-items',
                  format: 'json',
                  columns: {
                    orderId: 'STRING',
                    productId: 'STRING',
                    quantity: 'INT',
                    unitPrice: 'DOUBLE',
                    itemTime: 'TIMESTAMP(3)',
                  },
                  watermark: { column: 'itemTime', expression: "itemTime - INTERVAL '5' SECOND" },
                },
                {
                  table: 'products',
                  topic: 'ecom.products',
                  format: 'debezium-json',
                  columns: {
                    productId: 'STRING',
                    name: 'STRING',
                    category: 'STRING',
                    price: 'DOUBLE',
                    stock: 'INT',
                    updateTime: 'TIMESTAMP(3)',
                  },
                  primaryKey: ['productId'],
                },
                {
                  table: 'customers',
                  topic: 'ecom.customers',
                  format: 'debezium-json',
                  columns: {
                    customerId: 'STRING',
                    name: 'STRING',
                    email: 'STRING',
                    tier: 'STRING',
                    updateTime: 'TIMESTAMP(3)',
                  },
                  primaryKey: ['customerId'],
                },
              ],
            }],
          },
          jdbc: {
            catalogs: [{
              name: 'flink_sink',
              baseUrl: 'jdbc:postgresql://postgres:5432/',
              defaultDatabase: 'flink_sink',
            }],
          },
        },
      },
      pipelines: { '*': { parallelism: 2 } },
    },
    production: {
      cluster: { url: 'https://flink-prod:8081' },
      kubernetes: { namespace: 'flink-prod' },
      pipelines: { '*': { parallelism: 4 } },
    },
  },
});
`,
    },

    // ── Schemas ──────────────────────────────────────────────────────

    {
      // Source schema for `ecom.orders` — single-export so
      // `fr schema generate orders --force` regenerates it cleanly.
      path: "schemas/orders.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const OrdersSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    customerId: Field.STRING(),
    amount: Field.DOUBLE(),
    currency: Field.STRING(),
    status: Field.STRING(),
    orderTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'orderTime', expression: "orderTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      path: "schemas/order-items.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const OrderItemsSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    productId: Field.STRING(),
    quantity: Field.INT(),
    unitPrice: Field.DOUBLE(),
    itemTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'itemTime', expression: "itemTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      path: "schemas/products.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const ProductsSchema = Schema({
  fields: {
    productId: Field.STRING(),
    name: Field.STRING(),
    category: Field.STRING(),
    price: Field.DOUBLE(),
    stock: Field.INT(),
    updateTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'updateTime', expression: "updateTime - INTERVAL '5' SECOND" },
  primaryKey: { columns: ['productId'] },
});
`,
    },
    {
      // JDBC dimension read by ecom-customer-360 (flink_sink.customers). Split
      // out for a clean per-source layout; intentionally NOT a \`sources\` entry
      // because the local \`flink_sink.customers\` table isn't seeded (it's a
      // user-supplied dimension), so \`schema generate\` can't introspect it.
      path: "schemas/customers.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const CustomersSchema = Schema({
  fields: {
    customerId: Field.STRING(),
    name: Field.STRING(),
    email: Field.STRING(),
    tier: Field.STRING(),
    updateTime: Field.TIMESTAMP(3),
  },
  primaryKey: { columns: ['customerId'] },
});
`,
    },
    {
      // Output of ecom-order-enrichment (orders × items × products) and the
      // input of ecom-revenue-analytics. A derived, internal handoff topic —
      // not an external \`sources\` entry.
      path: "schemas/order-enriched.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const OrderEnrichedSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    customerId: Field.STRING(),
    amount: Field.DOUBLE(),
    currency: Field.STRING(),
    status: Field.STRING(),
    orderTime: Field.TIMESTAMP(3),
    productId: Field.STRING(),
    productName: Field.STRING(),
    category: Field.STRING(),
    quantity: Field.INT(),
    unitPrice: Field.DOUBLE(),
  },
  watermark: { column: 'orderTime', expression: "orderTime - INTERVAL '5' SECOND" },
});
`,
    },

    // ── Pipeline E1: Order Enrichment (3-way join) ──────────────────

    {
      path: "pipelines/ecom-order-enrichment/index.tsx",
      content: `import {
  Pipeline,
  KafkaSource,
  KafkaSink,
  IntervalJoin,
  TemporalJoin,
} from '@flink-reactor/dsl';
import { OrdersSchema } from '@/schemas/orders';
import { OrderItemsSchema } from '@/schemas/order-items';
import { ProductsSchema } from '@/schemas/products';

const orders = KafkaSource({
  name: "orders",
  topic: "ecom.orders",
  schema: OrdersSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "ecom-enrichment-orders",
});

const items = KafkaSource({
  name: "items",
  topic: "ecom.order-items",
  schema: OrderItemsSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "ecom-enrichment-items",
});

const products = KafkaSource({
  name: "products",
  topic: "ecom.products",
  schema: ProductsSchema,
  format: "debezium-json",
  bootstrapServers: "kafka:9092",
  consumerGroup: "ecom-enrichment-products",
});

const ordersWithItems = IntervalJoin({
  left: orders,
  right: items,
  on: "orders.orderId = items.orderId",
  interval: { from: "orderTime", to: "orderTime + INTERVAL '30' SECOND" },
});

const enriched = TemporalJoin({
  stream: ordersWithItems,
  temporal: products,
  on: "productId = productId",
  asOf: "orderTime",
});

export default (
  <Pipeline
    name="ecom-order-enrichment"
    mode="streaming"
    parallelism={4}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    restartStrategy={{ type: "fixed-delay", attempts: 3, delay: "10s" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/ecom-order-enrichment",
      "state.savepoints.dir": "s3://flink-state/savepoints/ecom-order-enrichment",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    {orders}
    {items}
    {products}
    {enriched}
    <KafkaSink
      topic="ecom.order-enriched"
      bootstrapServers="kafka:9092"
    />
  </Pipeline>
);
`,
    },

    // ── Pipeline E2: Revenue Analytics (sliding window + Top-N) ─────

    {
      path: "pipelines/ecom-revenue-analytics/index.tsx",
      content: `import {
  Pipeline,
  KafkaSource,
  KafkaSink,
  JdbcSink,
  SlideWindow,
  Aggregate,
  Route,
} from '@flink-reactor/dsl';
import { OrderEnrichedSchema } from '@/schemas/order-enriched';

export default (
  <Pipeline
    name="ecom-revenue-analytics"
    mode="streaming"
    parallelism={4}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    restartStrategy={{ type: "fixed-delay", attempts: 3, delay: "10s" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/ecom-revenue-analytics",
      "state.savepoints.dir": "s3://flink-state/savepoints/ecom-revenue-analytics",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    <KafkaSource
      topic="ecom.order-enriched"
      schema={OrderEnrichedSchema}
      bootstrapServers="kafka:9092"
      consumerGroup="ecom-revenue"
    />
    <Route>
      <Route.Default>
        <SlideWindow size="5 MINUTE" slide="1 MINUTE" on="orderTime" />
        <Aggregate
          groupBy={['category']}
          select={{
            category: 'category',
            totalRevenue: 'SUM(amount)',
            orderCount: 'COUNT(*)',
            windowStart: 'window_start',
            windowEnd: 'window_end',
          }}
        />
        <JdbcSink
          table="revenue_by_category"
          url="jdbc:postgresql://postgres:5432/flink_sink"
          upsertMode
          keyFields={['category', 'windowStart', 'windowEnd']}
        />
      </Route.Default>
      <Route.Branch condition="amount > 500">
        <KafkaSink
          topic="ecom.revenue-alerts"
          bootstrapServers="kafka:9092"
        />
      </Route.Branch>
    </Route>
  </Pipeline>
);
`,
    },

    // ── Pipeline E3: Customer 360 (lookup join + session window) ────

    {
      path: "pipelines/ecom-customer-360/index.tsx",
      content: `import {
  Pipeline,
  KafkaSource,
  JdbcSource,
  JdbcSink,
  LookupJoin,
  SessionWindow,
  Aggregate,
} from '@flink-reactor/dsl';
import { OrdersSchema } from '@/schemas/orders';
import { CustomersSchema } from '@/schemas/customers';

const orders = KafkaSource({
  topic: "ecom.orders",
  schema: OrdersSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "ecom-customer360",
});

const customers = JdbcSource({
  table: "customers",
  url: "jdbc:postgresql://postgres:5432/flink_sink",
  schema: CustomersSchema,
  lookupCache: { type: "lru", maxRows: 10000, ttl: "10min" },
});

export default (
  <Pipeline
    name="ecom-customer-360"
    mode="streaming"
    parallelism={2}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    restartStrategy={{ type: "fixed-delay", attempts: 3, delay: "10s" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/ecom-customer-360",
      "state.savepoints.dir": "s3://flink-state/savepoints/ecom-customer-360",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    {orders}
    {customers}
    {LookupJoin({
      input: orders,
      table: "customers",
      url: "jdbc:postgresql://postgres:5432/flink_sink",
      on: "customerId = customerId",
    })}
    <SessionWindow gap="30 MINUTE" on="orderTime" />
    <Aggregate
      groupBy={['customerId', 'name', 'tier']}
      select={{
        customerId: 'customerId',
        customerName: 'name',
        tier: 'tier',
        sessionOrders: 'COUNT(*)',
        sessionRevenue: 'SUM(amount)',
        windowStart: 'window_start',
        windowEnd: 'window_end',
      }}
    />
    <JdbcSink
      table="customer_sessions"
      url="jdbc:postgresql://postgres:5432/flink_sink"
      upsertMode
      keyFields={['customerId']}
    />
  </Pipeline>
);
`,
    },

    // ── Data Pump: DataGen → Kafka for all ecommerce topics ─────────

    {
      path: "pipelines/pump-ecom/index.tsx",
      content: `import {
  Pipeline,
  DataGenSource,
  KafkaSink,
  StatementSet,
} from '@flink-reactor/dsl';
import { OrdersSchema } from '@/schemas/orders';
import { OrderItemsSchema } from '@/schemas/order-items';
import { ProductsSchema } from '@/schemas/products';
import { CustomersSchema } from '@/schemas/customers';

export default (
  <Pipeline
    name="pump-ecom"
    mode="streaming"
    parallelism={4}
    stateBackend="rocksdb"
    checkpoint={{ interval: "60s", mode: "exactly-once" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/pump-ecom",
      "state.savepoints.dir": "s3://flink-state/savepoints/pump-ecom",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    <StatementSet>
      {/* Orders: 2000/s */}
      <DataGenSource schema={OrdersSchema} rowsPerSecond={2000} />
      <KafkaSink topic="ecom.orders" bootstrapServers="kafka:9092" />

      {/* Order Items: 6000/s (~3 items per order) */}
      <DataGenSource schema={OrderItemsSchema} rowsPerSecond={6000} />
      <KafkaSink topic="ecom.order-items" bootstrapServers="kafka:9092" />

      {/* Products CDC: 200/s (price/stock changes) */}
      <DataGenSource schema={ProductsSchema} rowsPerSecond={200} />
      <KafkaSink topic="ecom.products" bootstrapServers="kafka:9092" />

      {/* Customers CDC: 100/s (profile updates) */}
      <DataGenSource schema={CustomersSchema} rowsPerSecond={100} />
      <KafkaSink topic="ecom.customers" bootstrapServers="kafka:9092" />
    </StatementSet>
  </Pipeline>
);
`,
    },

    // ── Per-pipeline READMEs ──────────────────────────────────────────

    pipelineReadme({
      pipelineName: "ecom-order-enrichment",
      tagline:
        "Three-way join: orders × order-items (interval) × products (temporal/versioned) → enriched-orders Kafka topic.",
      demonstrates: [
        '`<KafkaSource>` × 3, including a `format="debezium-json"` versioned product stream.',
        "`<IntervalJoin>` joining orders and order-items on `orderId` within a 30-second event-time window.",
        "`<TemporalJoin>` enriching the joined stream against the versioned product dimension via `FOR SYSTEM_TIME AS OF orderTime`.",
        "`<KafkaSink>` writing the enriched flow to `ecom.order-enriched`.",
      ],
      topology: `KafkaSource (orders)        ─┐
KafkaSource (items)         ─┼─► IntervalJoin (orders.orderId = items.orderId, ±30s) ─┐
                             │                                                       ├─► TemporalJoin (productId, AS OF orderTime) ─► KafkaSink (ecom.order-enriched)
KafkaSource (products, debz) ────────────────────────────────────────────────────────┘`,
      schemas: [
        "`schemas/orders.ts`, `schemas/order-items.ts`, `schemas/products.ts` (with `productId` PK) — the three joined Kafka inputs (regenerable via `fr schema generate`)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    pipelineReadme({
      pipelineName: "ecom-revenue-analytics",
      tagline:
        "5-minute hopping-window per-category revenue analytics with a Route branch for high-value alerts.",
      demonstrates: [
        "`<KafkaSource>` consuming the `ecom.order-enriched` topic produced by `ecom-order-enrichment`.",
        "`<Route>` splitting the stream into a default analytics branch and a high-value-alerts branch.",
        '`<SlideWindow size="5 MINUTE" slide="1 MINUTE">` for overlapping per-category aggregates.',
        "`<JdbcSink>` for the rolling-window stats and `<KafkaSink>` for the alerting branch.",
      ],
      topology: `KafkaSource (ecom.order-enriched)
  └── Route
        ├── Default ─► SlideWindow (5min/1min, on=orderTime) ─► Aggregate (GROUP BY category, SUM/COUNT) ─► JdbcSink (revenue_by_category, upsert)
        └── Branch (amount > 500) ─► KafkaSink (ecom.revenue-alerts)`,
      schemas: [
        "`schemas/order-enriched.ts` — `OrderEnrichedSchema` (consumer side)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    pipelineReadme({
      pipelineName: "ecom-customer-360",
      tagline:
        "Per-customer 30-minute session aggregates with a JDBC dimension lookup, written upsert-style back to Postgres.",
      demonstrates: [
        "`<KafkaSource>` (orders) plus `<JdbcSource>` (customers) — heterogeneous source mix.",
        "`<LookupJoin>` against the customers JDBC dimension with an LRU cache (10k rows, 10min TTL).",
        '`<SessionWindow gap="30 MINUTE" on="orderTime">` modelling per-customer browsing sessions.',
        "`<JdbcSink>` with `upsertMode` and `keyFields={['customerId']}` for the running-state output.",
      ],
      topology: `KafkaSource (orders) ─┐
                       ├─► LookupJoin (customers JDBC, lru cache) ─► SessionWindow (30min, on=orderTime) ─► Aggregate (GROUP BY customerId/name/tier) ─► JdbcSink (customer_sessions, upsert)
JdbcSource (customers) ─┘`,
      schemas: [
        "`schemas/orders.ts` — `OrdersSchema`; `schemas/customers.ts` — `CustomersSchema` (with `customerId` PK)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    pipelineReadme({
      pipelineName: "pump-ecom",
      tagline:
        "Internal data-generator pipeline that pumps synthetic orders, order-items, products, and customers into the corresponding Kafka topics.",
      demonstrates: [
        "`<DataGenSource>` × 4 driving `<KafkaSink>` × 4 inside a single `<StatementSet>`.",
        "Bundle-internal pump pattern (no upstream Apache Flink source — exists only to feed the three main ecommerce pipelines on the local sim).",
      ],
      topology: `DataGenSource (Order)          ─► KafkaSink (ecom.orders)
DataGenSource (OrderItem)      ─► KafkaSink (ecom.order-items)
DataGenSource (Product)        ─► KafkaSink (ecom.products)
DataGenSource (Customer)       ─► KafkaSink (ecom.customers)`,
      schemas: ["the split `schemas/*.ts` — same schemas the consumers read"],
      runCommand: `pnpm synth
pnpm test`,
    }),

    // ── Tests ────────────────────────────────────────────────────────

    templatePipelineTestStub({
      pipelineName: "ecom-order-enrichment",
      loadBearingPatterns: [
        /BETWEEN/i,
        /FOR SYSTEM_TIME AS OF/i,
        /debezium-json/i,
      ],
    }),
    templatePipelineTestStub({
      pipelineName: "ecom-revenue-analytics",
      loadBearingPatterns: [/HOP\(/i, /GROUP BY/i, /jdbc/i, /PRIMARY KEY/i],
    }),
    templatePipelineTestStub({
      pipelineName: "ecom-customer-360",
      loadBearingPatterns: [/SESSION/i, /jdbc/i, /GROUP BY/i],
    }),
    templatePipelineTestStub({
      pipelineName: "pump-ecom",
      loadBearingPatterns: [/INSERT INTO/i, /datagen/i],
    }),

    // ── Project-root README ───────────────────────────────────────────

    templateReadme({
      templateName: "ecommerce",
      tagline:
        "Three end-to-end e-commerce pipelines plus a data pump: order-enrichment (3-way interval+temporal join), revenue-analytics (sliding window + Route branching), customer-360 (lookup join + session window). The richest scaffolder template — exercises the full DSL surface across joins, windows, route-branching, and heterogeneous sources/sinks.",
      pipelines: [
        {
          name: "ecom-order-enrichment",
          pitch:
            "Orders × order-items (interval) × products (temporal) → enriched-orders Kafka topic.",
        },
        {
          name: "ecom-revenue-analytics",
          pitch:
            "5-minute hopping-window per-category revenue with a high-value-alert branch via `<Route>`.",
        },
        {
          name: "ecom-customer-360",
          pitch:
            "30-minute session aggregates with JDBC lookup-join enrichment, upsert sink to Postgres.",
        },
        {
          name: "pump-ecom",
          pitch:
            "Internal DataGen → Kafka pump for orders, order-items, products, and customers.",
        },
      ],
      gettingStarted: [
        "pnpm install",
        "pnpm synth",
        "pnpm test",
        "# Optional: regenerate a source schema from the seeded Kafka topic",
        "pnpm fr cluster up && pnpm fr schema generate orders",
      ],
    }),
  ]
}
