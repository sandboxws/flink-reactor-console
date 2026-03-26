import { ColumnsTable, SqlHighlight, TemplateSelector } from "@flink-reactor/ui"
import { createCatalogSchema } from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const schema = createCatalogSchema()

const columnsTableProps: PropDef[] = [
  {
    name: "columns",
    type: "CatalogColumnInfo[]",
    description: "Array of column objects with name and type fields",
  },
]

const templateSelectorProps: PropDef[] = [
  {
    name: "onSelect",
    type: "(sql: string) => void",
    description:
      "Called with the resolved SQL template string when the user clicks Use Query",
  },
]

const sqlHighlightProps: PropDef[] = [
  { name: "code", type: "string", description: "SQL code string to display" },
  {
    name: "className",
    type: "string",
    default: "undefined",
    description: "Additional CSS classes for the pre wrapper",
  },
]

const TOC = [
  { id: "columns-table", label: "ColumnsTable" },
  { id: "template-selector", label: "TemplateSelector" },
  { id: "sql-highlight", label: "SqlHighlight" },
]

const sampleSql = `SELECT
  date_format(created_at, 'yyyy-MM-dd') AS day,
  customer_id,
  SUM(amount) AS total_amount,
  COUNT(*) AS order_count
FROM default_catalog.default_database.orders
WHERE status = 'COMPLETED'
GROUP BY
  date_format(created_at, 'yyyy-MM-dd'),
  customer_id
ORDER BY day DESC
LIMIT 100;`

/** Showcase route: /domain/catalogs -- Showcases catalog browser components (ColumnsTable, TemplateSelector, SqlHighlight) with fixture data. */
function CatalogsDomainPage() {
  return (
    <ShowcasePage
      title="Catalogs"
      description="Schema and SQL browsing. 3 components."
      items={TOC}
    >
      <Section
        id="columns-table"
        title="ColumnsTable"
        description="Searchable, sortable, paginated table of catalog column metadata."
      >
        <div className="max-w-xl">
          <ColumnsTable
            columns={schema.columns.map((c) => ({
              name: c.name,
              type: c.type,
            }))}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={columnsTableProps} />
        </div>
      </Section>

      <Section
        id="template-selector"
        title="TemplateSelector"
        description="Dialog-based SQL template browser with category grouping, preview, and placeholder inputs."
      >
        <div className="flex items-center gap-4">
          <TemplateSelector onSelect={(_sql) => {}} />
          <span className="text-xs text-fg-muted">
            Click the button to open the template dialog
          </span>
        </div>
        <div className="mt-4">
          <PropsTable props={templateSelectorProps} />
        </div>
      </Section>

      <Section
        id="sql-highlight"
        title="SqlHighlight"
        description="Monospace SQL code display with consistent styling."
      >
        <div className="glass-card overflow-hidden p-4">
          <SqlHighlight
            code={sampleSql}
            className="rounded-md bg-[#1a1b26] p-4 text-xs"
          />
        </div>
        <div className="mt-4">
          <PropsTable props={sqlHighlightProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/catalogs")({
  component: CatalogsDomainPage,
})
