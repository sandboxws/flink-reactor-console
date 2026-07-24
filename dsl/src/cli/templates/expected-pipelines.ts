import type { TemplateName } from "@/cli/commands/new.js"

// ── Expected pipeline count per template ─────────────────────────────
// `minimal` + `monorepo` are structural templates with no pipelines of
// their own; every other template ships ≥1 pipeline under `pipelines/`.
// Kept explicit (not derived) so adding/removing a pipeline forces an
// update here, making the template surface area observable.
//
// This is registry data — the template manifest (`src/templates/manifest.ts`)
// and the scaffold→synth test helper both read it. It lives outside
// `__tests__/` so the manifest can import it without pulling test-only
// helpers (and `node:fs`/`runSynth`) into the bundled DSL.

export const EXPECTED_PIPELINES: Record<TemplateName, readonly string[]> = {
  starter: ["hello-world"],
  minimal: [],
  monorepo: [],
  "cdc-lakehouse": ["cdc-to-lakehouse"],
  "data-quality": ["order-cleanup"],
  "realtime-analytics": ["page-view-analytics"],
  ecommerce: [
    "ecom-customer-360",
    "ecom-order-enrichment",
    "ecom-revenue-analytics",
    "pump-ecom",
  ],
  "ride-sharing": ["rides-surge-pricing", "rides-trip-tracking"],
  "grocery-delivery": ["grocery-order-fulfillment", "grocery-store-rankings"],
  banking: ["bank-compliance-agg", "bank-fraud-detection"],
  "iot-factory": ["iot-predictive-maintenance", "pump-iot"],
  "lakehouse-ingestion": ["lakehouse-ingest", "pump-lakehouse"],
  "lakehouse-analytics": [
    "medallion-bronze",
    "medallion-gold",
    "medallion-silver",
    "pump-medallion",
  ],
  "pg-fluss-paimon": ["ingest", "serve"],
  "stock-basics": [
    "getting-started",
    "stream-sql-union",
    "stream-window-sql",
    "wordcount-sql",
  ],
  "stock-ds-easy": [
    "session-windowing",
    "socket-window-wordcount",
    "window-join",
    "window-wordcount",
    "wordcount-streaming",
  ],
  "stock-ds-moderate": [
    "count-product-sales-dsv2",
    "join-dsv2",
    "pump-state-machine-cep",
    "side-output-routing",
    "state-machine-cep",
  ],
  "stock-temporal-topn": [
    "pump-temporal-join-fx",
    "temporal-join-fx",
    "updating-top-city",
  ],
}
