/**
 * SQL explore templates for the catalog browser.
 *
 * Provides pre-built query templates that users can apply to any catalog table
 * (e.g., preview rows, describe schema) as well as sample queries against
 * well-known demo databases (Pagila, Chinook, Employees).
 */

/** A single SQL query template with metadata for the catalog explorer UI. */
export interface ExploreTemplate {
  /** Display name shown in the template picker. */
  name: string
  /** Short description of what the query does. */
  description: string
  /** SQL template string. May contain `{{catalog}}`, `{{database}}`, and `{{table}}` placeholders. */
  sql: string
  /** Grouping label for the template (e.g., "Pagila", "Chinook"). */
  category?: string
  /** When `true`, the query is ready to run without placeholder substitution. */
  prefilled?: boolean
}

/**
 * Generic table-exploration templates with `{{catalog}}`, `{{database}}`, and
 * `{{table}}` placeholders. Resolved at runtime via {@link resolveTemplate}.
 */
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

/**
 * Pre-filled sample queries targeting well-known demo databases
 * (Pagila, Chinook, Employees). These are ready to execute without
 * placeholder substitution.
 */
export const SAMPLE_QUERY_TEMPLATES: ExploreTemplate[] = [
  // Pagila — DVD rental database
  {
    name: "Films by actor",
    description: "Multi-table JOIN — find all films featuring a specific actor",
    category: "Pagila",
    prefilled: true,
    sql: `SELECT
  a.first_name,
  a.last_name,
  f.title,
  f.release_year,
  f.rating
FROM \`pagila\`.\`public\`.\`actor\` AS a
JOIN \`pagila\`.\`public\`.\`film_actor\` AS fa ON a.actor_id = fa.actor_id
JOIN \`pagila\`.\`public\`.\`film\` AS f ON fa.film_id = f.film_id
WHERE a.last_name = 'GUINESS'
ORDER BY f.release_year DESC
LIMIT 20`,
  },
  {
    name: "Revenue by category",
    description: "Aggregation — total rental revenue per film category",
    category: "Pagila",
    prefilled: true,
    sql: `SELECT
  c.name AS category,
  COUNT(*) AS total_rentals,
  SUM(p.amount) AS total_revenue
FROM \`pagila\`.\`public\`.\`category\` AS c
JOIN \`pagila\`.\`public\`.\`film_category\` AS fc ON c.category_id = fc.category_id
JOIN \`pagila\`.\`public\`.\`inventory\` AS i ON fc.film_id = i.film_id
JOIN \`pagila\`.\`public\`.\`rental\` AS r ON i.inventory_id = r.inventory_id
JOIN \`pagila\`.\`public\`.\`payment\` AS p ON r.rental_id = p.rental_id
GROUP BY c.name
ORDER BY total_revenue DESC`,
  },
  {
    name: "Top renters",
    description: "GROUP BY + ORDER BY — customers with the most rentals",
    category: "Pagila",
    prefilled: true,
    sql: `SELECT
  c.first_name,
  c.last_name,
  c.email,
  COUNT(*) AS rental_count
FROM \`pagila\`.\`public\`.\`customer\` AS c
JOIN \`pagila\`.\`public\`.\`rental\` AS r ON c.customer_id = r.customer_id
GROUP BY c.first_name, c.last_name, c.email
ORDER BY rental_count DESC
LIMIT 10`,
  },

  // Chinook — digital music store
  {
    name: "Tracks per genre",
    description: "GROUP BY + HAVING — genres with more than 100 tracks",
    category: "Chinook",
    prefilled: true,
    sql: `SELECT
  g.name AS genre,
  COUNT(*) AS track_count,
  ROUND(AVG(t.milliseconds) / 60000, 1) AS avg_minutes
FROM \`chinook\`.\`public\`.\`genre\` AS g
JOIN \`chinook\`.\`public\`.\`track\` AS t ON g.genre_id = t.genre_id
GROUP BY g.name
HAVING COUNT(*) > 100
ORDER BY track_count DESC`,
  },
  {
    name: "Customer purchases",
    description: "Multi-join — customer invoice details with track names",
    category: "Chinook",
    prefilled: true,
    sql: `SELECT
  c.first_name,
  c.last_name,
  i.invoice_date,
  t.name AS track,
  il.unit_price,
  il.quantity
FROM \`chinook\`.\`public\`.\`customer\` AS c
JOIN \`chinook\`.\`public\`.\`invoice\` AS i ON c.customer_id = i.customer_id
JOIN \`chinook\`.\`public\`.\`invoice_line\` AS il ON i.invoice_id = il.invoice_id
JOIN \`chinook\`.\`public\`.\`track\` AS t ON il.track_id = t.track_id
ORDER BY i.invoice_date DESC
LIMIT 20`,
  },
  {
    name: "Top selling artists",
    description: "Aggregation — artists ranked by total sales revenue",
    category: "Chinook",
    prefilled: true,
    sql: `SELECT
  ar.name AS artist,
  COUNT(*) AS tracks_sold,
  SUM(il.unit_price * il.quantity) AS total_revenue
FROM \`chinook\`.\`public\`.\`artist\` AS ar
JOIN \`chinook\`.\`public\`.\`album\` AS al ON ar.artist_id = al.artist_id
JOIN \`chinook\`.\`public\`.\`track\` AS t ON al.album_id = t.album_id
JOIN \`chinook\`.\`public\`.\`invoice_line\` AS il ON t.track_id = il.track_id
GROUP BY ar.name
ORDER BY total_revenue DESC
LIMIT 15`,
  },

  // Employees — HR database (uses `employees` schema, not `public`)
  {
    name: "Salary ranking",
    description:
      "Window function — top earners per department using ROW_NUMBER",
    category: "Employees",
    prefilled: true,
    sql: `SELECT * FROM (
  SELECT
    e.first_name,
    e.last_name,
    d.dept_name,
    s.amount AS salary,
    ROW_NUMBER() OVER (
      PARTITION BY d.dept_name
      ORDER BY s.amount DESC
    ) AS rank_in_dept
  FROM \`employees\`.\`employees\`.\`employee\` AS e
  JOIN \`employees\`.\`employees\`.\`department_employee\` AS de
    ON e.id = de.employee_id
  JOIN \`employees\`.\`employees\`.\`department\` AS d
    ON de.department_id = d.id
  JOIN \`employees\`.\`employees\`.\`salary\` AS s
    ON e.id = s.employee_id
  WHERE de.to_date = DATE '9999-01-01'
    AND s.to_date = DATE '9999-01-01'
) ranked
WHERE rank_in_dept <= 3`,
  },
  {
    name: "Department stats",
    description: "Aggregate statistics — salary min, max, avg per department",
    category: "Employees",
    prefilled: true,
    sql: `SELECT
  d.dept_name,
  COUNT(*) AS employee_count,
  MIN(s.amount) AS min_salary,
  MAX(s.amount) AS max_salary,
  ROUND(AVG(CAST(s.amount AS DOUBLE)), 0) AS avg_salary
FROM \`employees\`.\`employees\`.\`department\` AS d
JOIN \`employees\`.\`employees\`.\`department_employee\` AS de
  ON d.id = de.department_id
JOIN \`employees\`.\`employees\`.\`salary\` AS s
  ON de.employee_id = s.employee_id
WHERE de.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
GROUP BY d.dept_name
ORDER BY avg_salary DESC`,
  },
  {
    name: "Current titles",
    description: "Date filtering — employees with their current job titles",
    category: "Employees",
    prefilled: true,
    sql: `SELECT
  e.first_name,
  e.last_name,
  t.title,
  t.from_date,
  e.hire_date
FROM \`employees\`.\`employees\`.\`employee\` AS e
JOIN \`employees\`.\`employees\`.\`title\` AS t
  ON e.id = t.employee_id
WHERE t.to_date = DATE '9999-01-01'
ORDER BY t.from_date DESC
LIMIT 20`,
  },
]

/**
 * Replace `{{catalog}}`, `{{database}}`, and `{{table}}` placeholders in a
 * template's SQL string with the provided identifiers.
 */
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
