// Template names + expected pipelines, duplicated here as DELIBERATE
// literals (not imported from src/): if a template is renamed or a
// pipeline added/removed, this suite failing is the desired signal that
// the published surface changed.

export interface TemplateContract {
  readonly template: string
  readonly pipelines: readonly string[]
}

/** Default suite: a representative cross-section (4 of 17). */
export const DEFAULT_TEMPLATES: readonly TemplateContract[] = [
  { template: "starter", pipelines: ["hello-world"] },
  { template: "cdc-lakehouse", pipelines: ["cdc-to-lakehouse"] },
  { template: "monorepo", pipelines: [] },
  { template: "realtime-analytics", pipelines: ["page-view-analytics"] },
]

/** Nightly matrix: every template the scaffolder ships. */
export const ALL_TEMPLATES: readonly TemplateContract[] = [
  ...DEFAULT_TEMPLATES,
  { template: "minimal", pipelines: [] },
  {
    template: "ecommerce",
    pipelines: [
      "ecom-customer-360",
      "ecom-order-enrichment",
      "ecom-revenue-analytics",
      "pump-ecom",
    ],
  },
  {
    template: "ride-sharing",
    pipelines: ["rides-surge-pricing", "rides-trip-tracking"],
  },
  {
    template: "grocery-delivery",
    pipelines: ["grocery-order-fulfillment", "grocery-store-rankings"],
  },
  {
    template: "banking",
    pipelines: ["bank-compliance-agg", "bank-fraud-detection"],
  },
  {
    template: "iot-factory",
    pipelines: ["iot-predictive-maintenance", "pump-iot"],
  },
  {
    template: "lakehouse-ingestion",
    pipelines: ["lakehouse-ingest", "pump-lakehouse"],
  },
  {
    template: "lakehouse-analytics",
    pipelines: [
      "medallion-bronze",
      "medallion-gold",
      "medallion-silver",
      "pump-medallion",
    ],
  },
  { template: "pg-fluss-paimon", pipelines: ["ingest", "serve"] },
  {
    template: "stock-basics",
    pipelines: [
      "getting-started",
      "stream-sql-union",
      "stream-window-sql",
      "wordcount-sql",
    ],
  },
  {
    template: "stock-ds-easy",
    pipelines: [
      "session-windowing",
      "socket-window-wordcount",
      "window-join",
      "window-wordcount",
      "wordcount-streaming",
    ],
  },
  {
    template: "stock-ds-moderate",
    pipelines: [
      "count-product-sales-dsv2",
      "join-dsv2",
      "pump-state-machine-cep",
      "side-output-routing",
      "state-machine-cep",
    ],
  },
  {
    template: "stock-temporal-topn",
    pipelines: [
      "pump-temporal-join-fx",
      "temporal-join-fx",
      "updating-top-city",
    ],
  },
]
