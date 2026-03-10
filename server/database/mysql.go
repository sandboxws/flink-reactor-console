package database

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql" // MySQL driver registration
)

// MySQLDriver implements Driver for MySQL using go-sql-driver/mysql.
type MySQLDriver struct {
	db *sql.DB
}

// systemSchemas are MySQL schemas excluded from browsing.
var systemSchemas = map[string]bool{
	"information_schema": true,
	"mysql":              true,
	"performance_schema": true,
	"sys":                true,
}

// Connect opens a connection to the MySQL database.
func (d *MySQLDriver) Connect(_ context.Context, dsn string) error {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("mysql connect: %w", err)
	}
	d.db = db
	return nil
}

// Close shuts down the database connection.
func (d *MySQLDriver) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

// Ping verifies connectivity to the database.
func (d *MySQLDriver) Ping(ctx context.Context) error {
	return d.db.PingContext(ctx)
}

// ListSchemas returns all non-system schemas with table counts.
func (d *MySQLDriver) ListSchemas(ctx context.Context) ([]Schema, error) {
	query := `
		SELECT s.SCHEMA_NAME,
		       COUNT(t.TABLE_NAME) AS table_count
		FROM information_schema.SCHEMATA s
		LEFT JOIN information_schema.TABLES t
		       ON t.TABLE_SCHEMA = s.SCHEMA_NAME
		GROUP BY s.SCHEMA_NAME
		ORDER BY s.SCHEMA_NAME`

	rows, err := d.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list schemas: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var schemas []Schema
	for rows.Next() {
		var s Schema
		if err := rows.Scan(&s.Name, &s.TableCount); err != nil {
			return nil, fmt.Errorf("scan schema: %w", err)
		}
		if systemSchemas[s.Name] {
			continue
		}
		schemas = append(schemas, s)
	}
	return schemas, rows.Err()
}

// ListTables returns all tables and views in the given schema with row count estimates.
func (d *MySQLDriver) ListTables(ctx context.Context, schema string) ([]TableSummary, error) {
	query := `
		SELECT TABLE_NAME,
		       TABLE_SCHEMA,
		       TABLE_TYPE,
		       COALESCE(TABLE_ROWS, 0) AS row_estimate
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = ?
		ORDER BY TABLE_NAME`

	rows, err := d.db.QueryContext(ctx, query, schema)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var tables []TableSummary
	for rows.Next() {
		var t TableSummary
		var tableType string
		if err := rows.Scan(&t.Name, &t.Schema, &tableType, &t.RowCountEstimate); err != nil {
			return nil, fmt.Errorf("scan table: %w", err)
		}
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
func (d *MySQLDriver) GetTableDetail(ctx context.Context, schema, table string) (*TableDetail, error) {
	detail := &TableDetail{Name: table, Schema: schema}

	// Columns
	colQuery := `
		SELECT COLUMN_NAME,
		       COLUMN_TYPE,
		       IS_NULLABLE = 'YES',
		       COALESCE(COLUMN_DEFAULT, ''),
		       COLUMN_KEY = 'PRI',
		       COALESCE(COLUMN_COMMENT, '')
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION`

	colRows, err := d.db.QueryContext(ctx, colQuery, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get columns: %w", err)
	}
	defer func() { _ = colRows.Close() }()

	for colRows.Next() {
		var col Column
		if err := colRows.Scan(&col.Name, &col.DataType, &col.Nullable, &col.DefaultValue, &col.IsPrimaryKey, &col.Comment); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		detail.Columns = append(detail.Columns, col)
	}
	if err := colRows.Err(); err != nil {
		return nil, err
	}

	// Indexes
	idxQuery := `
		SELECT INDEX_NAME,
		       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX),
		       NOT NON_UNIQUE,
		       INDEX_TYPE
		FROM information_schema.STATISTICS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE
		ORDER BY INDEX_NAME`

	idxRows, err := d.db.QueryContext(ctx, idxQuery, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get indexes: %w", err)
	}
	defer func() { _ = idxRows.Close() }()

	for idxRows.Next() {
		var idx Index
		var colList string
		if err := idxRows.Scan(&idx.Name, &colList, &idx.Unique, &idx.Type); err != nil {
			return nil, fmt.Errorf("scan index: %w", err)
		}
		idx.Columns = strings.Split(colList, ",")
		idx.Type = strings.ToLower(idx.Type)
		detail.Indexes = append(detail.Indexes, idx)
	}
	if err := idxRows.Err(); err != nil {
		return nil, err
	}

	// Constraints
	conQuery := `
		SELECT tc.CONSTRAINT_NAME,
		       tc.CONSTRAINT_TYPE,
		       GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION),
		       COALESCE(kcu.REFERENCED_TABLE_NAME, ''),
		       COALESCE(GROUP_CONCAT(kcu.REFERENCED_COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION), '')
		FROM information_schema.TABLE_CONSTRAINTS tc
		JOIN information_schema.KEY_COLUMN_USAGE kcu
		       ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
		      AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
		      AND kcu.TABLE_NAME = tc.TABLE_NAME
		WHERE tc.TABLE_SCHEMA = ? AND tc.TABLE_NAME = ?
		GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE, kcu.REFERENCED_TABLE_NAME
		ORDER BY tc.CONSTRAINT_NAME`

	conRows, err := d.db.QueryContext(ctx, conQuery, schema, table)
	if err != nil {
		return nil, fmt.Errorf("get constraints: %w", err)
	}
	defer func() { _ = conRows.Close() }()

	for conRows.Next() {
		var c Constraint
		var colList, refColList string
		if err := conRows.Scan(&c.Name, &c.Type, &colList, &c.RefTable, &refColList); err != nil {
			return nil, fmt.Errorf("scan constraint: %w", err)
		}
		c.Columns = strings.Split(colList, ",")
		if refColList != "" {
			c.RefColumns = strings.Split(refColList, ",")
		}
		detail.Constraints = append(detail.Constraints, c)
	}
	if err := conRows.Err(); err != nil {
		return nil, err
	}

	return detail, nil
}

// ExecuteQuery runs a query within a read-only transaction with timeout and row limit.
func (d *MySQLDriver) ExecuteQuery(ctx context.Context, sqlStr string, timeout time.Duration, maxRows int) (*QueryResult, error) {
	start := time.Now()

	tx, err := d.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Set statement timeout (MySQL uses milliseconds)
	timeoutMs := int(timeout.Milliseconds())
	if _, err := tx.ExecContext(ctx, fmt.Sprintf("SET max_execution_time = %d", timeoutMs)); err != nil {
		return nil, fmt.Errorf("set max_execution_time: %w", err)
	}

	// Execute with maxRows+1 to detect truncation
	limitedSQL := fmt.Sprintf("SELECT * FROM (%s) AS _q LIMIT %d", sqlStr, maxRows+1) //nolint:gosec // G201: maxRows is an int, not user input; sql is pre-validated by DDL check
	rows, err := tx.QueryContext(ctx, limitedSQL)
	if err != nil {
		return nil, fmt.Errorf("execute query: %w", err)
	}
	defer func() { _ = rows.Close() }()

	// Build result columns
	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, fmt.Errorf("column types: %w", err)
	}
	resultCols := make([]ResultColumn, len(colTypes))
	for i, ct := range colTypes {
		resultCols[i] = ResultColumn{
			Name:     ct.Name(),
			DataType: ct.DatabaseTypeName(),
		}
	}

	// Collect rows
	colCount := len(colTypes)
	var resultRows [][]any
	for rows.Next() {
		values := make([]any, colCount)
		ptrs := make([]any, colCount)
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		// Convert []byte to string for readability
		for i, v := range values {
			if b, ok := v.([]byte); ok {
				values[i] = string(b)
			}
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
func (d *MySQLDriver) TableNames(ctx context.Context) ([]string, error) {
	query := `
		SELECT CONCAT(TABLE_SCHEMA, '.', TABLE_NAME)
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
		ORDER BY TABLE_SCHEMA, TABLE_NAME`

	rows, err := d.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

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
