import type { ScaffoldOptions, TemplateFile } from "@/cli/commands/new.js"
import {
  pipelineReadme,
  sharedFiles,
  templatePipelineTestStub,
  templateReadme,
} from "./shared.js"

export function getGroceryDeliveryTemplates(
  opts: ScaffoldOptions,
): TemplateFile[] {
  return [
    ...sharedFiles(opts),
    {
      path: "flink-reactor.config.ts",
      content: `import { defineConfig } from '@flink-reactor/dsl';

export default defineConfig({
  flink: { version: '${opts.flinkVersion}' },

  // Kafka for orders; Postgres for the JDBC sinks (substitution + delivery alerts).
  // \`schemaRegistryUrl\` is the bundled registry's host port — read by
  // \`fr schema generate\`, not by the runtime connectors (which read the topics
  // with \`format="json"\` / \`format="debezium-json"\`, both registry-free).
  services: { kafka: { bootstrapServers: 'kafka:9092', schemaRegistryUrl: 'http://localhost:8082' }, postgres: {} },

  // \`sources\` powers \`fr schema generate\`: introspect each input topic's row
  // schema from the registry and emit \`schemas/<name>.ts\`. All three shipped
  // schemas also carry a watermark, which introspection can't infer — re-add it
  // after regenerating with \`--force\`.
  sources: {
    'order-lines': { type: 'kafka', topic: 'grocery.order-lines' },
    'store-inventory': { type: 'kafka', topic: 'grocery.store-inventory' },
    ratings: { type: 'kafka', topic: 'grocery.ratings' },
  },

  environments: {
    minikube: {
      cluster: { url: 'http://localhost:8081' },
      sim: {
        init: {
          kafka: {
            topics: ['grocery.substitution-alerts', 'grocery.order-lines', 'grocery.store-inventory', 'grocery.ratings'],
            catalogs: [{
              name: 'grocery',
              tables: [
                {
                  table: 'orders',
                  topic: 'grocery.orders',
                  format: 'json',
                  columns: {
                    orderId: 'STRING',
                    storeId: 'STRING',
                    customerId: 'STRING',
                    itemCount: 'INT',
                    totalAmount: 'DOUBLE',
                    orderTime: 'TIMESTAMP(3)',
                  },
                  watermark: { column: 'orderTime', expression: "orderTime - INTERVAL '5' SECOND" },
                },
                {
                  table: 'order_lines',
                  topic: 'grocery.order-lines',
                  format: 'json',
                  columns: {
                    orderId: 'STRING',
                    storeId: 'STRING',
                    productId: 'STRING',
                    quantity: 'INT',
                    lineTime: 'TIMESTAMP(3)',
                  },
                  watermark: { column: 'lineTime', expression: "lineTime - INTERVAL '5' SECOND" },
                },
                {
                  table: 'store_inventory',
                  topic: 'grocery.store-inventory',
                  format: 'debezium-json',
                  columns: {
                    storeId: 'STRING',
                    productId: 'STRING',
                    stockLevel: 'INT',
                    substitutionId: 'STRING',
                    updateTime: 'TIMESTAMP(3)',
                  },
                  primaryKey: ['storeId', 'productId'],
                },
                {
                  table: 'ratings',
                  topic: 'grocery.ratings',
                  format: 'json',
                  columns: {
                    orderId: 'STRING',
                    storeId: 'STRING',
                    shopperRating: 'DOUBLE',
                    storeRating: 'DOUBLE',
                    itemQuality: 'DOUBLE',
                    ratingTime: 'TIMESTAMP(3)',
                  },
                  watermark: { column: 'ratingTime', expression: "ratingTime - INTERVAL '5' SECOND" },
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
    {
      // Row schema for the `grocery.order-lines` topic (source `order-lines`).
      // Single-export so `fr schema generate order-lines --force` regenerates
      // it cleanly; the other grocery shapes live in their own schemas/*.ts.
      path: "schemas/order-lines.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

// One record per product-line within an order; bridges orders ×
// inventory on the full (storeId, productId) composite key.
export const OrderLinesSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    storeId: Field.STRING(),
    productId: Field.STRING(),
    quantity: Field.INT(),
    lineTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'lineTime', expression: "lineTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      // Row schema for the `grocery.store-inventory` debezium-json CDC topic
      // (source `store-inventory`). Single-export so `fr schema generate
      // store-inventory --force` regenerates it cleanly.
      path: "schemas/store-inventory.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const StoreInventorySchema = Schema({
  fields: {
    storeId: Field.STRING(),
    productId: Field.STRING(),
    stockLevel: Field.INT(),
    substitutionId: Field.STRING(),
    updateTime: Field.TIMESTAMP(3),
  },
  primaryKey: { columns: ['storeId', 'productId'] },
  watermark: { column: 'updateTime', expression: "updateTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      // Row schema for the `grocery.ratings` topic (source `ratings`).
      // Single-export so `fr schema generate ratings --force` regenerates it
      // cleanly.
      path: "schemas/ratings.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const RatingsSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    storeId: Field.STRING(),
    shopperRating: Field.DOUBLE(),
    storeRating: Field.DOUBLE(),
    itemQuality: Field.DOUBLE(),
    ratingTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'ratingTime', expression: "ratingTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      path: "schemas/grocery-order.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

// Base grocery-order shape for the \`grocery.orders\` topic — not read by a
// \`<KafkaSource>\` in either shipped pipeline, so it has no \`sources\` entry
// and lives apart from the per-source schemas/*.ts files.
export const GroceryOrderSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    storeId: Field.STRING(),
    customerId: Field.STRING(),
    itemCount: Field.INT(),
    totalAmount: Field.DOUBLE(),
    orderTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'orderTime', expression: "orderTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      path: "pipelines/grocery-order-fulfillment/index.tsx",
      content: `import {
  Pipeline, KafkaSource, KafkaSink, JdbcSink,
  TemporalJoin, Route,
} from '@flink-reactor/dsl';
import { OrderLinesSchema } from '@/schemas/order-lines';
import { StoreInventorySchema } from '@/schemas/store-inventory';

const orderLines = KafkaSource({
  name: "orderLines",
  topic: "grocery.order-lines",
  schema: OrderLinesSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "grocery-fulfillment",
});

const inventory = KafkaSource({
  name: "inventory",
  topic: "grocery.store-inventory",
  schema: StoreInventorySchema,
  format: "debezium-json",
  bootstrapServers: "kafka:9092",
  consumerGroup: "grocery-inventory",
});

const enriched = TemporalJoin({
  stream: orderLines,
  temporal: inventory,
  on: "orderLines.storeId = inventory.storeId AND orderLines.productId = inventory.productId",
  asOf: "lineTime",
});

export default (
  <Pipeline
    name="grocery-order-fulfillment"
    mode="streaming"
    parallelism={4}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/grocery-order-fulfillment",
      "state.savepoints.dir": "s3://flink-state/savepoints/grocery-order-fulfillment",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    {orderLines}
    {inventory}
    {enriched}
    <Route>
      <Route.Branch condition="stockLevel > 0">
        <JdbcSink table="fulfillment_queue" url="jdbc:postgresql://postgres:5432/flink_sink" />
      </Route.Branch>
      <Route.Branch condition="stockLevel = 0">
        <KafkaSink topic="grocery.substitution-alerts" bootstrapServers="kafka:9092" />
      </Route.Branch>
    </Route>
  </Pipeline>
);
`,
    },
    {
      path: "pipelines/grocery-store-rankings/index.tsx",
      content: `import {
  Pipeline, KafkaSource, JdbcSink,
  Deduplicate, TumbleWindow, Aggregate,
} from '@flink-reactor/dsl';
import { RatingsSchema } from '@/schemas/ratings';

export default (
  <Pipeline
    name="grocery-store-rankings"
    mode="streaming"
    parallelism={2}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/grocery-store-rankings",
      "state.savepoints.dir": "s3://flink-state/savepoints/grocery-store-rankings",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    <KafkaSource topic="grocery.ratings" schema={RatingsSchema} bootstrapServers="kafka:9092" consumerGroup="grocery-rankings" />
    <Deduplicate key={['orderId']} order="ratingTime" keep="first" />
    <TumbleWindow size="15 MINUTE" on="ratingTime" />
    <Aggregate
      groupBy={['storeId']}
      select={{
        storeId: 'storeId',
        avgRating: 'AVG(storeRating)',
        ratingCount: 'COUNT(*)',
        windowEnd: 'window_end',
      }}
    />
    <JdbcSink table="store_rankings" url="jdbc:postgresql://postgres:5432/flink_sink" upsertMode keyFields={['storeId']} />
  </Pipeline>
);
`,
    },

    // ── Per-pipeline READMEs ──────────────────────────────────────────

    pipelineReadme({
      pipelineName: "grocery-order-fulfillment",
      tagline:
        "Order-line fulfillment routing: per-line inventory lookup via temporal join, then split between Postgres queue and Kafka substitution alerts.",
      demonstrates: [
        "Two `<KafkaSource>`: order lines (event-time) and store inventory (`debezium-json`, versioned).",
        "`<TemporalJoin>` against a versioned inventory dimension on `(storeId, productId)` `AS OF lineTime`.",
        "`<Route>` with two predicate branches: in-stock → JDBC fulfillment queue; out-of-stock → Kafka substitution-alerts topic.",
      ],
      topology: `KafkaSource (orderLines)              ─┐
                                       ├─► TemporalJoin (storeId+productId AS OF lineTime)
KafkaSource (inventory, debezium-json) ─┘                       └── Route
                                                                      ├── Branch (stockLevel > 0) ─► JdbcSink (fulfillment_queue)
                                                                      └── Branch (stockLevel = 0) ─► KafkaSink (grocery.substitution-alerts)`,
      schemas: [
        "`schemas/order-lines.ts` — `OrderLinesSchema` (with `lineTime` watermark); `schemas/store-inventory.ts` — `StoreInventorySchema` (with `(storeId, productId)` composite PK and `updateTime` watermark)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    pipelineReadme({
      pipelineName: "grocery-store-rankings",
      tagline:
        "Per-store 15-minute rolling rating averages with first-row deduplication on `orderId` to dampen duplicate ratings.",
      demonstrates: [
        '`<Deduplicate key={[\'orderId\']} order="ratingTime" keep="first">` → `ROW_NUMBER()` first-row pattern.',
        '`<TumbleWindow size="15 MINUTE" on="ratingTime">` for the per-store aggregation window.',
        "`<Aggregate>` computing `AVG(storeRating)` and `COUNT(*)` per store.",
        "`<JdbcSink>` with `upsertMode` and `keyFields={['storeId']}` for the live per-store rankings table.",
      ],
      topology: `KafkaSource (ratings, watermark on ratingTime)
  └── Deduplicate (key=orderId, order=ratingTime, keep=first)
        └── TumbleWindow (15 MINUTE, on=ratingTime)
              └── Aggregate (GROUP BY storeId — AVG, COUNT)
                    └── JdbcSink (store_rankings, upsert)`,
      schemas: [
        "`schemas/ratings.ts` — `RatingsSchema` (with watermark on `ratingTime`)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),

    // ── Tests ─────────────────────────────────────────────────────────

    templatePipelineTestStub({
      pipelineName: "grocery-order-fulfillment",
      loadBearingPatterns: [
        /FOR SYSTEM_TIME AS OF/i,
        /debezium-json/i,
        /grocery\.substitution-alerts/,
      ],
    }),
    templatePipelineTestStub({
      pipelineName: "grocery-store-rankings",
      loadBearingPatterns: [/ROW_NUMBER\(\)/i, /TUMBLE\(/i, /AVG\(/i],
    }),

    // ── Project-root README ───────────────────────────────────────────

    templateReadme({
      templateName: "grocery-delivery",
      tagline:
        "Two grocery-delivery pipelines: `grocery-order-fulfillment` (CDC-versioned inventory temporal join + `<Route>` to in-stock vs substitution-alerts) and `grocery-store-rankings` (deduplicate + tumbling-window per-store rating averages).",
      pipelines: [
        {
          name: "grocery-order-fulfillment",
          pitch:
            "Order lines × versioned inventory temporal join, routed to fulfillment queue or substitution alerts.",
        },
        {
          name: "grocery-store-rankings",
          pitch:
            "Deduplicated per-store rolling-window rating averages with upsert sink.",
        },
      ],
      gettingStarted: [
        "pnpm install",
        "pnpm synth",
        "pnpm test",
        "# Optional: regenerate the source schemas from the seeded Kafka topics",
        "pnpm fr cluster up",
        "pnpm fr schema generate order-lines",
        "pnpm fr schema generate store-inventory",
        "pnpm fr schema generate ratings",
      ],
    }),
  ]
}
