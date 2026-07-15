package database

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresDriver implements Driver for PostgreSQL using pgx/v5.
type PostgresDriver struct {
	pool *pgxpool.Pool
}

// Connect establishes a connection pool to the PostgreSQL database.
func (d *PostgresDriver) Connect(ctx context.Context, dsn string) error {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("postgres connect: %w", err)
	}
	d.pool = pool
	return nil
}

// Close shuts down the connection pool.
func (d *PostgresDriver) Close() error {
	if d.pool != nil {
		d.pool.Close()
	}
	return nil
}

// Ping verifies connectivity to the database.
func (d *PostgresDriver) Ping(ctx context.Context) error {
	return d.pool.Ping(ctx)
}

// ListSchemas returns all non-system schemas with table counts.
func (d *PostgresDriver) ListSchemas(ctx context.Context) ([]Schema, error) {
	query := `
		SELECT s.schema_name,
		       COUNT(t.table_name)::int AS table_count
		FROM information_schema.schemata s
		LEFT JOIN information_schema.tables t
		       ON t.table_schema = s.schema_name
		WHERE s.schema_name NOT LIKE 'pg_%'
		  AND s.schema_name != 'information_schema'
		GROUP BY s.schema_name
		ORDER BY s.schema_name`

	rows, err := d.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list schemas: %w", err)
	}
	defer rows.Close()

	var schemas []Schema
	for rows.Next() {
		var s Schema
		if err := rows.Scan(&s.Name, &s.TableCount); err != nil {
			return nil, fmt.Errorf("scan schema: %w", err)
		}
		schemas = append(schemas, s)
	}
	return schemas, rows.Err()
}

// ListTables returns all tables and views in the given schema with row count estimates.
func (d *PostgresDriver) ListTables(ctx context.Context, schema string) ([]TableSummary, error) {
	query := `
		SELECT t.table_name,
		       t.table_schema,
		       t.table_type,
		       COALESCE(s.n_live_tup, 0) AS row_estimate
		FROM information_schema.tables t
		LEFT JOIN pg_stat_user_tables s
		       ON s.schemaname = t.table_schema AND s.relname = t.table_name
		WHERE t.table_schema = $1
		ORDER BY t.table_name`

	rows, err := d.pool.Query(ctx, query, schema)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	defer rows.Close()

	var tables []TableSummary
	for rows.Next() {
		var t TableSummary
		var tableType string
		if err := rows.Scan(&t.Name, &t.Schema, &tableType, &t.RowCountEstimate); err != nil {
			return nil, fmt.Errorf("scan table: %w", err)
		}
		// Normalize "BASE TABLE" to "TABLE"
		if tableType == "BASE TABLE" {
			t.Type = "TABLE"
		} else {
			t.Type = tableType
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

// GetTableDetail returns columns, indexes, and constraints for a table.
func (d *PostgresDriver) GetTableDetail(ctx context.Context, schema, table string) (*TableDetail, error) {
	detail := &TableDetail{Name: table, Schema: schema}

	// Columns
	colQuery := `
		SELECT c.column_name,
		       c.data_type,
		       c.is_nullable = 'YES',
		       COALESCE(c.column_default, ''),
		       COALESCE(pgd.description, '')
		FROM information_schema.columns c
		LEFT JOIN pg_catalog.pg_statio_all_tables st
		       ON st.schemaname = c.table_schema AND st.relname = c.table_name
		LEFT JOIN pg_catalog.pg_description pgd
		       ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
		WHERE c.table_schema = $1 AND c.table_name = $2
		ORDER BY c.ordinal_position`

	colRows, err := d.pool.Query(ctx, colQuery, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get columns: %w", err)
	}
	defer colRows.Close()

	for colRows.Next() {
		var col Column
		if err := colRows.Scan(&col.Name, &col.DataType, &col.Nullable, &col.DefaultValue, &col.Comment); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		detail.Columns = append(detail.Columns, col)
	}
	if err := colRows.Err(); err != nil {
		return nil, err
	}

	// Primary key columns
	pkQuery := `
		SELECT a.attname
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		WHERE i.indrelid = ($1 || '.' || $2)::regclass
		  AND i.indisprimary`

	pkRows, err := d.pool.Query(ctx, pkQuery, schema, table)
	if err == nil {
		defer pkRows.Close()
		pkCols := make(map[string]bool)
		for pkRows.Next() {
			var colName string
			if err := pkRows.Scan(&colName); err == nil {
				pkCols[colName] = true
			}
		}
		for i := range detail.Columns {
			if pkCols[detail.Columns[i].Name] {
				detail.Columns[i].IsPrimaryKey = true
			}
		}
	}

	// Indexes
	idxQuery := `
		SELECT indexname,
		       indexdef
		FROM pg_indexes
		WHERE schemaname = $1 AND tablename = $2
		ORDER BY indexname`

	idxRows, err := d.pool.Query(ctx, idxQuery, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get indexes: %w", err)
	}
	defer idxRows.Close()

	for idxRows.Next() {
		var name, indexdef string
		if err := idxRows.Scan(&name, &indexdef); err != nil {
			return nil, fmt.Errorf("scan index: %w", err)
		}
		idx := Index{
			Name:   name,
			Unique: strings.Contains(strings.ToUpper(indexdef), "UNIQUE"),
			Type:   parseIndexType(indexdef),
		}
		idx.Columns = parseIndexColumns(indexdef)
		detail.Indexes = append(detail.Indexes, idx)
	}
	if err := idxRows.Err(); err != nil {
		return nil, err
	}

	// Constraints
	conQuery := `
		SELECT con.conname,
		       con.contype::text,
		       array_agg(att.attname ORDER BY u.pos),
		       COALESCE(ref_cls.relname, ''),
		       COALESCE(array_agg(ref_att.attname ORDER BY u.pos) FILTER (WHERE ref_att.attname IS NOT NULL), ARRAY[]::text[])
		FROM pg_constraint con
		JOIN pg_class cls ON cls.oid = con.conrelid
		JOIN pg_namespace ns ON ns.oid = cls.relnamespace
		CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, pos)
		JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
		LEFT JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
		LEFT JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ru(attnum, pos) ON ru.pos = u.pos
		LEFT JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = ru.attnum
		WHERE ns.nspname = $1 AND cls.relname = $2
		GROUP BY con.conname, con.contype, ref_cls.relname
		ORDER BY con.conname`

	conRows, err := d.pool.Query(ctx, conQuery, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get constraints: %w", err)
	}
	defer conRows.Close()

	for conRows.Next() {
		var c Constraint
		var conType string
		if err := conRows.Scan(&c.Name, &conType, &c.Columns, &c.RefTable, &c.RefColumns); err != nil {
			return nil, fmt.Errorf("scan constraint: %w", err)
		}
		c.Type = pgConstraintType(conType)
		detail.Constraints = append(detail.Constraints, c)
	}
	if err := conRows.Err(); err != nil {
		return nil, err
	}

	return detail, nil
}

// ExecuteQuery runs a query within a read-only transaction with statement timeout and row limit.
func (d *PostgresDriver) ExecuteQuery(ctx context.Context, sql string, timeout time.Duration, maxRows int) (*QueryResult, error) {
	start := time.Now()

	tx, err := d.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Set statement timeout
	timeoutMs := int(timeout.Milliseconds())
	if _, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL statement_timeout = %d", timeoutMs)); err != nil {
		return nil, fmt.Errorf("set statement_timeout: %w", err)
	}

	// Execute with maxRows+1 to detect truncation
	limitedSQL := fmt.Sprintf("SELECT * FROM (%s) AS _q LIMIT %d", sql, maxRows+1) //nolint:gosec // G201: maxRows is an int, not user input; sql is pre-validated by DDL check
	rows, err := tx.Query(ctx, limitedSQL)
	if err != nil {
		return nil, fmt.Errorf("execute query: %w", err)
	}
	defer rows.Close()

	// Build result columns
	descs := rows.FieldDescriptions()
	resultCols := make([]ResultColumn, len(descs))
	for i, fd := range descs {
		resultCols[i] = ResultColumn{
			Name:     fd.Name,
			DataType: pgTypeOID(fd.DataTypeOID),
		}
	}

	// Collect rows
	var resultRows [][]any
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		resultRows = append(resultRows, values)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	truncated := len(resultRows) > maxRows
	if truncated {
		resultRows = resultRows[:maxRows]
	}

	return &QueryResult{
		Columns:         resultCols,
		Rows:            resultRows,
		RowCount:        len(resultRows),
		ExecutionTimeMs: time.Since(start).Milliseconds(),
		Truncated:       truncated,
	}, nil
}

// TableNames returns all schema-qualified table names for highlight matching.
func (d *PostgresDriver) TableNames(ctx context.Context) ([]string, error) {
	query := `
		SELECT table_schema || '.' || table_name
		FROM information_schema.tables
		WHERE table_schema NOT LIKE 'pg_%'
		  AND table_schema != 'information_schema'
		ORDER BY table_schema, table_name`

	rows, err := d.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// parseIndexType extracts the index method from a CREATE INDEX statement.
func parseIndexType(indexdef string) string {
	upper := strings.ToUpper(indexdef)
	if strings.Contains(upper, "USING HASH") {
		return "hash"
	}
	if strings.Contains(upper, "USING GIN") {
		return "gin"
	}
	if strings.Contains(upper, "USING GIST") {
		return "gist"
	}
	return "btree"
}

// parseIndexColumns extracts column names from a CREATE INDEX definition.
func parseIndexColumns(indexdef string) []string {
	// Extract content between parentheses
	start := strings.Index(indexdef, "(")
	end := strings.LastIndex(indexdef, ")")
	if start == -1 || end == -1 || end <= start {
		return nil
	}
	colStr := indexdef[start+1 : end]
	parts := strings.Split(colStr, ",")
	cols := make([]string, 0, len(parts))
	for _, p := range parts {
		col := strings.TrimSpace(p)
		// Remove ASC/DESC suffix
		col = strings.TrimSuffix(col, " ASC")
		col = strings.TrimSuffix(col, " DESC")
		col = strings.TrimSuffix(col, " NULLS FIRST")
		col = strings.TrimSuffix(col, " NULLS LAST")
		if col != "" {
			cols = append(cols, col)
		}
	}
	return cols
}

// pgConstraintType converts PostgreSQL constraint type codes to human-readable names.
func pgConstraintType(code string) string {
	switch code {
	case "p":
		return "PRIMARY KEY"
	case "f":
		return "FOREIGN KEY"
	case "u":
		return "UNIQUE"
	case "c":
		return "CHECK"
	case "x":
		return "EXCLUSION"
	default:
		return code
	}
}

// pgTypeOID maps common PostgreSQL OIDs to type names.
func pgTypeOID(oid uint32) string {
	switch oid {
	case 16:
		return "boolean"
	case 20:
		return "bigint"
	case 21:
		return "smallint"
	case 23:
		return "integer"
	case 25:
		return "text"
	case 700:
		return "real"
	case 701:
		return "double precision"
	case 1042:
		return "character"
	case 1043:
		return "character varying"
	case 1082:
		return "date"
	case 1114:
		return "timestamp"
	case 1184:
		return "timestamptz"
	case 1700:
		return "numeric"
	case 2950:
		return "uuid"
	case 3802:
		return "jsonb"
	case 114:
		return "json"
	default:
		return fmt.Sprintf("oid:%d", oid)
	}
}
