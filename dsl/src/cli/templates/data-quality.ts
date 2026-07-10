import type { ScaffoldOptions, TemplateFile } from "@/cli/commands/new.js"
import {
  pipelineReadme,
  sharedFiles,
  templatePipelineTestStub,
  templateReadme,
} from "./shared.js"

// data-quality — a streaming record-normalization pipeline that tours the
// field-transform components no other template exercises:
//   <Cast safe> (TRY_CAST) / <Coalesce> / <Rename> / <AddField> / <Drop>
// plus production-grade `telemetry.labels`, `checkpoint`, and a blue-green
// `upgradeStrategy` (zero-downtime redeploys via FlinkBlueGreenDeployment).
//
// Pinned to Flink 2.2 (current house version, matches the local cluster
// image). All connectors are Kafka, so the only infra the pipeline needs is
// a broker.
export function getDataQualityTemplates(opts: ScaffoldOptions): TemplateFile[] {
  return [
    ...sharedFiles(opts),
    {
      path: "flink-reactor.config.ts",
      content: `import { defineConfig } from '@flink-reactor/dsl';

export default defineConfig({
  // 2.2 is the current house version and matches the local cluster image.
  flink: { version: '2.2' },

  services: { kafka: { bootstrapServers: 'kafka:9092' } },

  environments: {
    development: {
      cluster: { url: 'http://localhost:8081' },
      pipelines: { '*': { parallelism: 1 } },
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
      path: "schemas/order-events.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

// Raw, untrusted order events. \`amount\` and \`quantity\` arrive as strings
// (JSON with no type enforcement) so the cleanup pipeline can coerce them
// with a safe TRY_CAST.
export const RawOrderEventSchema = Schema({
  fields: {
    orderId: Field.STRING(),
    userId: Field.STRING(),
    amount: Field.STRING(),
    quantity: Field.STRING(),
    currency: Field.STRING(),
    status: Field.STRING(),
    email: Field.STRING(),
    eventTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'eventTime', expression: 'eventTime - INTERVAL \\'5\\' SECOND' },
});
`,
    },

    // ── Pipeline: order-cleanup ───────────────────────────────────────
    {
      path: "pipelines/order-cleanup/index.tsx",
      content: `import { Pipeline, KafkaSource, KafkaSink, Cast, Coalesce, Rename, AddField, Drop } from '@flink-reactor/dsl';
import { RawOrderEventSchema } from '@/schemas/order-events';

// Normalize a raw, untrusted order-event stream into a clean topic using the
// field-transform components in a single linear pipeline:
//
//   raw ─► Cast(safe) ─► Coalesce ─► Rename ─► AddField ─► Drop ─► orders.clean
//
//   - Cast(safe): TRY_CAST dirty string amount/quantity to numbers
//   - Coalesce:   default a missing currency to 'USD'
//   - Rename:     userId → customerId (canonical column name)
//   - AddField:   stamp an ingestedAt audit timestamp
//   - Drop:       scrub the email PII column before the clean topic
//
// Runs under a blue-green upgradeStrategy so redeploys are zero-downtime:
// a green FlinkDeployment is brought up and traffic swapped atomically
// (emits kind: FlinkBlueGreenDeployment). telemetry.labels feed Prometheus
// discovery.
export default (
  <Pipeline
    name="order-cleanup"
    parallelism={2}
    checkpoint={{ interval: '30s', mode: 'exactly-once' }}
    telemetry={{ labels: { team: 'data-quality', tier: 'gold' } }}
    upgradeStrategy={{ mode: 'blue-green', upgradeMode: 'savepoint' }}
  >
    <KafkaSource
      topic="orders.raw"
      schema={RawOrderEventSchema}
      format="json"
      bootstrapServers="kafka:9092"
      consumerGroup="order-cleanup"
    />
    <Cast safe columns={{ amount: 'DECIMAL(12, 2)', quantity: 'INT' }} />
    <Coalesce columns={{ currency: "'USD'" }} />
    <Rename columns={{ userId: 'customerId' }} />
    <AddField columns={{ ingestedAt: 'CURRENT_TIMESTAMP' }} types={{ ingestedAt: 'TIMESTAMP(3)' }} />
    <Drop columns={['email']} />
    <KafkaSink topic="orders.clean" format="json" bootstrapServers="kafka:9092" />
  </Pipeline>
);
`,
    },
    pipelineReadme({
      pipelineName: "order-cleanup",
      tagline:
        "Coerce, default, rename, augment, and scrub a raw order-event stream with the field-transform components — served blue-green.",
      demonstrates: [
        "`<Cast safe>` (TRY_CAST) coercing dirty string `amount`/`quantity` to numbers.",
        "`<Coalesce>` defaulting a missing `currency` to `'USD'`.",
        "`<Rename>` mapping `userId` → `customerId` for canonical naming.",
        "`<AddField>` stamping an `ingestedAt` audit timestamp.",
        "`<Drop>` scrubbing the `email` PII column.",
        "`telemetry.labels` for Prometheus discovery; blue-green `upgradeStrategy` (`FlinkBlueGreenDeployment`) for zero-downtime redeploys.",
      ],
      topology: `KafkaSource (orders.raw, json, watermark on eventTime)
  └── Cast(safe)   amount→DECIMAL(12,2), quantity→INT   (TRY_CAST)
        └── Coalesce   currency → 'USD'
              └── Rename   userId → customerId
                    └── AddField   ingestedAt = CURRENT_TIMESTAMP
                          └── Drop   email (PII)
                                └── KafkaSink (orders.clean)`,
      schemas: [
        "`schemas/order-events.ts` — `RawOrderEventSchema` (untrusted, string `amount`/`quantity`)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    templatePipelineTestStub({
      pipelineName: "order-cleanup",
      loadBearingPatterns: [/TRY_CAST/i, /COALESCE/i, /customerId/],
    }),

    templateReadme({
      templateName: "data-quality",
      tagline:
        "A streaming record-normalization pipeline: coerce dirty types, default missing values, rename to canonical columns, stamp an audit timestamp, and scrub PII — all with the field-transform components no other template exercises. Ships production-grade telemetry, checkpointing, and a blue-green upgrade strategy.",
      pipelines: [
        {
          name: "order-cleanup",
          pitch:
            "Cast → Coalesce → Rename → AddField → Drop: coerce, default, rename, augment, and scrub a raw stream, served blue-green.",
        },
      ],
      prerequisites: ["Kafka broker (topics are created by `fr sim up`)"],
      gettingStarted: ["pnpm install", "pnpm synth", "pnpm test"],
    }),
  ]
}
