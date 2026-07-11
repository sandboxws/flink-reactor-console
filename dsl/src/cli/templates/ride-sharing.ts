import type { ScaffoldOptions, TemplateFile } from "@/cli/commands/new.js"
import {
  pipelineReadme,
  sharedFiles,
  templatePipelineTestStub,
  templateReadme,
} from "./shared.js"

export function getRideSharingTemplates(opts: ScaffoldOptions): TemplateFile[] {
  return [
    ...sharedFiles(opts),
    {
      path: "flink-reactor.config.ts",
      content: `import { defineConfig } from '@flink-reactor/dsl';

export default defineConfig({
  flink: { version: '${opts.flinkVersion}' },

  // Kafka for the request stream; Postgres for the JDBC sinks (surge + alerts).
  // \`schemaRegistryUrl\` is the published host port of the bundled registry —
  // read only by \`fr schema generate\`, not by the runtime connectors (which
  // use \`format="json"\` / \`format="debezium-json"\`, both registry-free).
  services: { kafka: { bootstrapServers: 'kafka:9092', schemaRegistryUrl: 'http://localhost:8082' }, postgres: {} },

  // \`sources\` powers \`fr schema generate\`: introspect a topic's row schema
  // from the Schema Registry and (re)emit \`schemas/<name>.ts\`. One entry per
  // input topic a \`<KafkaSource>\` reads — the sink topics (rides.surge-prices,
  // rides.driver-alerts) are intentionally absent. \`fr cluster up\` registers
  // these subjects, so \`fr schema generate requests\` works out of the box.
  sources: {
    requests: { type: 'kafka', topic: 'rides.requests' },
    'trip-events': { type: 'kafka', topic: 'rides.trip-events' },
    'surge-zones': { type: 'kafka', topic: 'rides.surge-zones' },
  },

  environments: {
    minikube: {
      cluster: { url: 'http://localhost:8081' },
      sim: {
        init: {
          kafka: {
            topics: [
              'rides.surge-prices',
              'rides.driver-alerts',
            ],
            catalogs: [
              {
                name: 'rides',
                tables: [
                  {
                    table: 'requests',
                    topic: 'rides.requests',
                    columns: {
                      rideId: 'STRING',
                      riderId: 'STRING',
                      pickupLat: 'DOUBLE',
                      pickupLng: 'DOUBLE',
                      dropoffLat: 'DOUBLE',
                      dropoffLng: 'DOUBLE',
                      requestTime: 'TIMESTAMP(3)',
                    },
                    format: 'json',
                    watermark: { column: 'requestTime', expression: "requestTime - INTERVAL '5' SECOND" },
                  },
                  {
                    table: 'trip_events',
                    topic: 'rides.trip-events',
                    columns: {
                      rideId: 'STRING',
                      driverId: 'STRING',
                      status: 'STRING',
                      eventTime: 'TIMESTAMP(3)',
                    },
                    format: 'json',
                    watermark: { column: 'eventTime', expression: "eventTime - INTERVAL '5' SECOND" },
                  },
                  {
                    table: 'surge_zones',
                    topic: 'rides.surge-zones',
                    columns: {
                      zoneId: 'STRING',
                      baseMultiplier: 'DOUBLE',
                      updateTime: 'TIMESTAMP(3)',
                    },
                    format: 'debezium-json',
                    primaryKey: ['zoneId'],
                  },
                ],
              },
            ],
          },
          jdbc: {
            catalogs: [
              {
                name: 'flink_sink',
                baseUrl: 'jdbc:postgresql://postgres:5432/',
                defaultDatabase: 'flink_sink',
              },
            ],
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
      path: "schemas/requests.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const RequestsSchema = Schema({
  fields: {
    rideId: Field.STRING(),
    riderId: Field.STRING(),
    zoneId: Field.STRING(),
    pickupLat: Field.DOUBLE(),
    pickupLng: Field.DOUBLE(),
    dropoffLat: Field.DOUBLE(),
    dropoffLng: Field.DOUBLE(),
    requestTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'requestTime', expression: "requestTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      path: "schemas/trip-events.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const TripEventsSchema = Schema({
  fields: {
    rideId: Field.STRING(),
    driverId: Field.STRING(),
    status: Field.STRING(),
    eventTime: Field.TIMESTAMP(3),
  },
  watermark: { column: 'eventTime', expression: "eventTime - INTERVAL '5' SECOND" },
});
`,
    },
    {
      path: "schemas/surge-zones.ts",
      content: `import { Schema, Field } from '@flink-reactor/dsl';

export const SurgeZonesSchema = Schema({
  fields: {
    zoneId: Field.STRING(),
    baseMultiplier: Field.DOUBLE(),
    updateTime: Field.TIMESTAMP(3),
  },
  primaryKey: { columns: ['zoneId'] },
});
`,
    },
    {
      path: "pipelines/rides-trip-tracking/index.tsx",
      content: `import {
  Pipeline, KafkaSource, KafkaSink, JdbcSink,
  IntervalJoin, MatchRecognize, Route,
} from '@flink-reactor/dsl';
import { RequestsSchema } from '@/schemas/requests';
import { TripEventsSchema } from '@/schemas/trip-events';

const requests = KafkaSource({
  name: "requests",
  topic: "rides.requests",
  schema: RequestsSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "rides-tracking-req",
});

const events = KafkaSource({
  name: "events",
  topic: "rides.trip-events",
  schema: TripEventsSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "rides-tracking-events",
});

const joined = IntervalJoin({
  left: requests,
  right: events,
  on: "requests.rideId = events.rideId",
  interval: { from: "requestTime", to: "requestTime + INTERVAL '5' MINUTE" },
});

export default (
  <Pipeline
    name="rides-trip-tracking"
    mode="streaming"
    parallelism={4}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/rides-trip-tracking",
      "state.savepoints.dir": "s3://flink-state/savepoints/rides-trip-tracking",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    {requests}
    {events}
    {MatchRecognize({
      input: joined,
      orderBy: "eventTime",
      pattern: "request accept? pickup dropoff",
      define: {
        request: "status = 'requested'",
        accept: "status = 'accepted'",
        pickup: "status = 'pickup'",
        dropoff: "status = 'dropoff'",
      },
      measures: {
        rideId: 'LAST(rideId)',
        driverId: 'LAST(driverId)',
        tripStatus: 'LAST(status)',
        pickupTime: "FIRST(pickup.eventTime)",
        dropoffTime: "LAST(dropoff.eventTime)",
      },
    })}
    <Route>
      <Route.Branch condition="tripStatus = 'dropoff'">
        <JdbcSink table="completed_trips" url="jdbc:postgresql://postgres:5432/flink_sink" />
      </Route.Branch>
      <Route.Branch condition="tripStatus = 'cancelled'">
        <KafkaSink topic="rides.driver-alerts" bootstrapServers="kafka:9092" />
      </Route.Branch>
    </Route>
  </Pipeline>
);
`,
    },
    pipelineReadme({
      pipelineName: "rides-trip-tracking",
      tagline:
        "Per-ride trip-state CEP detection: requests × trip-events (interval-joined) → MATCH_RECOGNIZE → routed sinks.",
      demonstrates: [
        "Two `<KafkaSource>` event-time streams — `rides.requests` and `rides.trip-events`.",
        "`<IntervalJoin>` joining each request to events within a 5-minute window after the request time.",
        "`<MatchRecognize>` detecting the trip-state sequence `request → accept? → pickup → dropoff`.",
        "`<Route>` writing completed trips to Postgres and cancelled trips to a Kafka driver-alerts topic.",
      ],
      topology: `KafkaSource (requests) ─┐
                       ├─► IntervalJoin (rideId, ±5min) ─► MatchRecognize (request → accept? → pickup → dropoff)
KafkaSource (events)   ─┘                                      └── Route
                                                                    ├── Branch (tripStatus = 'dropoff')   ─► JdbcSink (completed_trips)
                                                                    └── Branch (tripStatus = 'cancelled') ─► KafkaSink (rides.driver-alerts)`,
      schemas: [
        "`schemas/requests.ts` — `RequestsSchema` (with `requestTime` watermark)",
        "`schemas/trip-events.ts` — `TripEventsSchema` (with `eventTime` watermark)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    pipelineReadme({
      pipelineName: "rides-surge-pricing",
      tagline:
        "Per-zone tumbling-window demand counts joined to a small surge-zones dimension via broadcast hint.",
      demonstrates: [
        '`<TumbleWindow size="1 MINUTE" on="requestTime">` for per-zone demand snapshots.',
        "`<Aggregate>` producing `COUNT(*)` per zone.",
        "`<BroadcastJoin>` enriching the demand stream against the small surge-zones table — a `BROADCAST` hint avoids shuffling the small side.",
        "`<KafkaSink>` writing the surge-priced output to `rides.surge-prices`.",
      ],
      topology: `KafkaSource (requests) ─► TumbleWindow (1 MINUTE, on=requestTime) ─► Aggregate (GROUP BY zoneId — COUNT(*))    ─┐
                                                                                                       ├─► BroadcastJoin (zoneId) ─► KafkaSink (rides.surge-prices)
KafkaSource (surge-zones, debezium-json)                                                              ─┘`,
      schemas: [
        "`schemas/requests.ts` — `RequestsSchema`",
        "`schemas/surge-zones.ts` — `SurgeZonesSchema` (with `zoneId` PK)",
      ],
      runCommand: `pnpm synth
pnpm test`,
    }),
    templatePipelineTestStub({
      pipelineName: "rides-trip-tracking",
      loadBearingPatterns: [/MATCH_RECOGNIZE/i, /BETWEEN/i, /jdbc/i],
    }),
    templatePipelineTestStub({
      pipelineName: "rides-surge-pricing",
      loadBearingPatterns: [/TUMBLE\(/i, /BROADCAST/i, /rides\.surge-prices/],
    }),
    templateReadme({
      templateName: "ride-sharing",
      tagline:
        "Two ride-sharing pipelines: `rides-trip-tracking` (CEP via `<MatchRecognize>` over an interval-joined request × event stream) and `rides-surge-pricing` (tumbling-window demand counts × broadcast-joined surge zones).",
      pipelines: [
        {
          name: "rides-trip-tracking",
          pitch:
            "MATCH_RECOGNIZE over interval-joined requests × events with routed completed-vs-cancelled sinks.",
        },
        {
          name: "rides-surge-pricing",
          pitch:
            "Tumbling-window per-zone demand counts × broadcast-joined surge zones, written to a Kafka surge-prices topic.",
        },
      ],
      gettingStarted: [
        "pnpm install",
        "pnpm synth",
        "pnpm test",
        "# Optional: regenerate a schema module from its seeded Kafka topic",
        "pnpm fr cluster up && pnpm fr schema generate requests",
      ],
    }),
    {
      path: "pipelines/rides-surge-pricing/index.tsx",
      content: `import {
  Pipeline, KafkaSource, KafkaSink,
  TumbleWindow, Aggregate, BroadcastJoin,
} from '@flink-reactor/dsl';
import { RequestsSchema } from '@/schemas/requests';
import { SurgeZonesSchema } from '@/schemas/surge-zones';

const requests = KafkaSource({
  topic: "rides.requests",
  schema: RequestsSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "rides-surge",
});

const surgeZones = KafkaSource({
  topic: "rides.surge-zones",
  schema: SurgeZonesSchema,
  bootstrapServers: "kafka:9092",
  consumerGroup: "rides-surge-config",
});

const windowed = TumbleWindow({ size: "1 MINUTE", on: "requestTime", children: requests });

const demand = Aggregate({
  groupBy: ['zoneId'],
  select: { zoneId: 'zoneId', demandCount: 'COUNT(*)', windowEnd: 'window_end' },
  children: windowed,
});

const surgeResult = BroadcastJoin({
  left: demand,
  right: surgeZones,
  on: "demand.zoneId = surgeZones.zoneId",
});

export default (
  <Pipeline
    name="rides-surge-pricing"
    mode="streaming"
    parallelism={4}
    stateBackend="rocksdb"
    checkpoint={{ interval: "30s", mode: "exactly-once" }}
    flinkConfig={{
      "state.checkpoints.dir": "s3://flink-state/checkpoints/rides-surge-pricing",
      "state.savepoints.dir": "s3://flink-state/savepoints/rides-surge-pricing",
      "s3.endpoint": "http://seaweedfs.flink-demo.svc:8333",
      "s3.path.style.access": "true",
    }}
  >
    {requests}
    {surgeZones}
    {surgeResult}
    <KafkaSink topic="rides.surge-prices" bootstrapServers="kafka:9092" />
  </Pipeline>
);
`,
    },
  ]
}
