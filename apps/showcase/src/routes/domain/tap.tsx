import type { TapColumnInfo, TapSourceConfigData } from "@flink-reactor/ui"
import {
  TapDataTable,
  TapErrorPanel,
  TapSourceConfig,
  TapStatusBar,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const tapColumns: TapColumnInfo[] = [
  { columnName: "order_id", dataType: "BIGINT", nullable: false },
  { columnName: "customer_id", dataType: "BIGINT", nullable: false },
  { columnName: "amount", dataType: "DECIMAL(10,2)", nullable: false },
  { columnName: "status", dataType: "VARCHAR", nullable: true },
  { columnName: "created_at", dataType: "TIMESTAMP(3)", nullable: false },
]

const tapRows = Array.from({ length: 25 }, (_, i) => ({
  order_id: 1000 + i,
  customer_id: 200 + (i % 5),
  amount: Number((Math.random() * 500 + 10).toFixed(2)),
  status: ["COMPLETED", "PENDING", "SHIPPED", "CANCELLED"][i % 4],
  created_at: new Date(Date.now() - (25 - i) * 1000).toISOString(),
}))

const tapDataTableProps: PropDef[] = [
  {
    name: "columns",
    type: "TapColumnInfo[]",
    description: "Column metadata with name, data type, and nullable flag",
  },
  {
    name: "rows",
    type: "Record<string, unknown>[]",
    description: "Data rows as key-value objects matching column names",
  },
  {
    name: "isStreaming",
    type: "boolean",
    description: "Whether data is actively streaming (controls loading states)",
  },
  {
    name: "autoScroll",
    type: "boolean",
    default: "true",
    description: "Auto-scroll to bottom on new rows",
  },
]

const tapStatusBarProps: PropDef[] = [
  {
    name: "totalRowCount",
    type: "number",
    description: "Total rows received so far",
  },
  {
    name: "rowsPerSecond",
    type: "number",
    description: "Current throughput estimate",
  },
  { name: "bufferSize", type: "number", description: "Max buffer capacity" },
  {
    name: "currentBufferCount",
    type: "number",
    description: "Current number of rows in buffer",
  },
  {
    name: "status",
    type: "TapSessionStatus",
    description:
      "Connection status: connecting, streaming, paused, error, closed, idle",
  },
  {
    name: "consumerGroupId",
    type: "string",
    description: "Kafka consumer group ID",
  },
]

const tapSourceConfigProps: PropDef[] = [
  {
    name: "config",
    type: "TapSourceConfigData",
    description: "Current source config (offset mode, buffer size, timestamps)",
  },
  {
    name: "consumerGroupId",
    type: "string",
    description: "Read-only consumer group ID",
  },
  {
    name: "onConfigChange",
    type: "(config: Partial<TapSourceConfigData>) => void",
    description: "Called when the user changes any config field",
  },
]

const tapErrorPanelProps: PropDef[] = [
  {
    name: "error",
    type: "string",
    description: "Raw error string (Java exception format supported)",
  },
  {
    name: "onRetry",
    type: "() => void",
    description: "Called when the retry button is clicked",
  },
]

const TOC = [
  { id: "tap-data-table", label: "TapDataTable" },
  { id: "tap-status-bar", label: "TapStatusBar" },
  { id: "tap-source-config", label: "TapSourceConfig" },
  { id: "tap-error-panel", label: "TapErrorPanel" },
]

const sampleError = `org.apache.flink.table.gateway.service.utils.SqlExecutionException: Failed to execute statement
\tat org.apache.flink.table.gateway.service.SqlGatewayServiceImpl.executeStatement(SqlGatewayServiceImpl.java:156)
\tat org.apache.flink.table.gateway.rest.handler.StatementExecuteHandler.handleRequest(StatementExecuteHandler.java:78)
Caused by: org.apache.flink.table.api.ValidationException: Table 'default_catalog.default_database.nonexistent_table' not found
\tat org.apache.flink.table.planner.catalog.CatalogSchemaTable.resolveTable(CatalogSchemaTable.java:98)
\t... 15 more`

/** Showcase route: /domain/tap -- Showcases TAP (live data tapping) components (TapDataTable, TapStatusBar, TapSourceConfig, TapErrorPanel) with fixture data. */
function TapDomainPage() {
  const [config, setConfig] = useState<TapSourceConfigData>({
    offsetMode: "latest",
    bufferSize: 10_000,
  })

  return (
    <ShowcasePage
      title="Tap"
      description="Live data tapping components. 4 components."
      items={TOC}
    >
      <Section
        id="tap-data-table"
        title="TapDataTable"
        description="Virtualized streaming data table with auto-scroll, column sorting, and cell formatting."
      >
        <div className="h-[350px]">
          <TapDataTable
            columns={tapColumns}
            rows={tapRows}
            isStreaming={false}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={tapDataTableProps} />
        </div>
      </Section>

      <Section
        id="tap-status-bar"
        title="TapStatusBar"
        description="Status bar showing row count, throughput, buffer usage, consumer group, and error state."
      >
        <div className="glass-card overflow-hidden">
          <TapStatusBar
            totalRowCount={25}
            rowsPerSecond={12}
            bufferSize={10_000}
            currentBufferCount={25}
            status="streaming"
            consumerGroupId="fr-tap-ecommerce-order-enrichment-abc123"
          />
        </div>
        <div className="mt-4">
          <PropsTable props={tapStatusBarProps} />
        </div>
      </Section>

      <Section
        id="tap-source-config"
        title="TapSourceConfig"
        description="Collapsible configuration panel for offset mode, buffer size, and timestamps."
      >
        <div className="glass-card max-w-md overflow-hidden">
          <TapSourceConfig
            config={config}
            consumerGroupId="fr-tap-ecommerce-order-enrichment-abc123"
            onConfigChange={(partial) =>
              setConfig((prev) => ({ ...prev, ...partial }))
            }
          />
        </div>
        <div className="mt-4">
          <PropsTable props={tapSourceConfigProps} />
        </div>
      </Section>

      <Section
        id="tap-error-panel"
        title="TapErrorPanel"
        description="Error display with Java exception parsing, collapsible stack trace, copy, and retry."
      >
        <div className="max-w-2xl">
          <TapErrorPanel error={sampleError} onRetry={() => {}} />
        </div>
        <div className="mt-4">
          <PropsTable props={tapErrorPanelProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/tap")({
  component: TapDomainPage,
})
