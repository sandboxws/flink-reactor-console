import type { ScaffoldOptions, TemplateFile } from "@/cli/commands/new.js"
import {
  pipelineReadme,
  sharedFiles,
  templatePipelineTestStub,
  templateReadme,
} from "./shared.js"

export function getStarterTemplates(opts: ScaffoldOptions): TemplateFile[] {
  return [
    ...sharedFiles(opts),
    {
      path: "flink-reactor.config.ts",
      content: `import { defineConfig } from '@flink-reactor/dsl';

export default defineConfig({
  flink: { version: '${opts.flinkVersion}' },

  // Kafka-only template: \`fr cluster up\` and \`fr sim up\` start Flink + Kafka.
  // No Postgres, Iceberg, or Fluss. \`schemaRegistryUrl\` is the published host
  // port of the bundled registry — read by \`fr schema generate\`, not by the
  // runtime connectors (which use \`format="debezium-json"\`, registry-free).
  services: { kafka: { bootstrapServers: 'kafka:9092', schemaRegistryUrl: 'http://localhost:8082' } },

  // \`sources\` powers \`fr schema generate\`: introspect the topic's row schema
  // from the Schema Registry and emit \`schemas/products.ts\`. \`fr cluster up\`
  // registers this topic's schema automatically, so \`fr schema generate
  // products\` works out of the box. (JSON Schema has no INT/BIGINT split, so
  // regenerated integers come back as BIGINT — narrow them if you want INT.)
  sources: {
    products: { type: 'kafka', topic: 'cdc.inventory.products' },
  },

  environments: {
    // Docker-compose by default — matches the platform docs' recommended
    // local lane. Override with \`fr up --runtime=minikube\` to exercise the
    // Kubernetes lane without editing config.
    development: {
      runtime: 'docker',
      supportedRuntimes: ['docker', 'minikube'],
      cluster:    { url: 'http://localhost:8081' },
      sqlGateway: { url: 'http://localhost:8083' },   // used when runtime=docker
      kubectl:    { context: 'minikube' },             // used when runtime=minikube
      sim: {
        init: {
          kafka: {
            topics: ['in-stock-products'],
            catalogs: [{
              name: 'cdc',
              tables: [{
                table: 'inventory_products',
                topic: 'cdc.inventory.products',
                format: 'debezium-json',
                columns: {
                  id: 'INT',
                  name: 'STRING',
                  category: 'STRING',
                  price: 'DOUBLE',
                  quantity: 'INT',
                },
                primaryKey: ['id'],
              }],
            }],
          },
        },
      },
      pipelines: { '*': { parallelism: 1 } },
    },

    // CI / integration tests — full K8s lane on minikube.
    test: {
      runtime: 'minikube',
      kubectl:    { context: 'minikube' },
      kubernetes: { namespace: 'flink-test' },
      pipelines:  { '*': { parallelism: 1 } },
    },

    // Pre-prod validation on a remote cluster. \`kubectl.context\` is required —
    // no sensible default exists.
    staging: {
      runtime: 'kubernetes',
      kubectl:    { context: 'staging' },
      kubernetes: { namespace: 'flink-staging' },
      pipelines:  { '*': { parallelism: 2 } },
    },

    production: {
      runtime: 'kubernetes',
      kubectl:    { context: 'production' },
      kubernetes: { namespace: 'flink-prod' },
      pipelines:  { '*': { parallelism: 4 } },
    },
  },
});
`,
    },
    {
      path: "schemas/products.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const ProductsSchema = Schema({
  fields: {
    id: Field.INT(),
    name: Field.STRING(),
    category: Field.STRING(),
    price: Field.DOUBLE(),
    quantity: Field.INT(),
  },
  primaryKey: { columns: ['id'] },
});
`,
    },
    {
      path: "pipelines/hello-world/index.tsx",
      content: `import { Pipeline, KafkaSource, KafkaSink, Filter } from '@flink-reactor/dsl';
import { ProductsSchema } from '@/schemas/products';

export default (
  <Pipeline name="hello-world">
    <KafkaSource
      topic="cdc.inventory.products"
      schema={ProductsSchema}
      format="debezium-json"
      bootstrapServers="kafka:9092"
      consumerGroup="hello-world"
    />
    <Filter condition="quantity > 0" />
    <KafkaSink
      topic="in-stock-products"
      bootstrapServers="kafka:9092"
    />
  </Pipeline>
);
`,
    },
    pipelineReadme({
      pipelineName: "hello-world",
      tagline:
        "Filter an in-stock products CDC stream and write the survivors to a downstream Kafka topic.",
      demonstrates: [
        '`<KafkaSource>` consuming `format="debezium-json"` (CDC retract changelog).',
        "`<Filter>` with a per-record SQL predicate (`quantity > 0`).",
        "`<KafkaSink>` writing the filtered stream to a downstream topic.",
      ],
      topology: `KafkaSource (cdc.inventory.products, debezium-json)
  └── Filter (quantity > 0)
        └── KafkaSink (in-stock-products)`,
      schemas: [
        "`schemas/products.ts` — `{ id, name, category, price, quantity }` with `id` as primary key",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    templatePipelineTestStub({
      pipelineName: "hello-world",
      loadBearingPatterns: [
        /cdc\.inventory\.products/,
        /quantity > 0/,
        /debezium-json/,
      ],
    }),
    templateReadme({
      templateName: "starter",
      tagline:
        "A minimal end-to-end FlinkReactor pipeline: Kafka CDC source → SQL Filter → Kafka sink. The smallest scaffold that exercises the full synthesis loop (DSL → Flink SQL → FlinkDeployment CRD).",
      pipelines: [
        {
          name: "hello-world",
          pitch:
            "CDC source filtered to in-stock products, written to a downstream Kafka topic.",
        },
      ],
      gettingStarted: [
        "pnpm install",
        "pnpm synth",
        "pnpm test",
        "# Optional: regenerate schemas/products.ts from the seeded Kafka topic",
        "pnpm fr cluster up && pnpm fr schema generate products",
      ],
    }),
  ]
}
