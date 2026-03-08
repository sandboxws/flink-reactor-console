export interface ExploreTemplate {
  name: string
  description: string
  sql: string
}

export const EXPLORE_TEMPLATES: ExploreTemplate[] = [
  {
    name: "Preview table",
    description: "Select first 100 rows from a table",
    sql: "SELECT * FROM `{{catalog}}`.`{{database}}`.`{{table}}` LIMIT 100",
  },
  {
    name: "Show columns",
    description: "Describe the table schema",
    sql: "DESCRIBE `{{catalog}}`.`{{database}}`.`{{table}}`",
  },
  {
    name: "Count rows",
    description: "Count total rows in a table",
    sql: "SELECT COUNT(*) AS total FROM `{{catalog}}`.`{{database}}`.`{{table}}`",
  },
  {
    name: "Sample recent",
    description: "Get 50 most recent rows ordered by first column",
    sql: "SELECT * FROM `{{catalog}}`.`{{database}}`.`{{table}}` ORDER BY 1 DESC LIMIT 50",
  },
]

export function resolveTemplate(
  template: ExploreTemplate,
  catalog: string,
  database: string,
  table: string,
): string {
  return template.sql
    .replaceAll("{{catalog}}", catalog)
    .replaceAll("{{database}}", database)
    .replaceAll("{{table}}", table)
}
