package database

import (
	"context"
	"fmt"
	"time"
)

// Client wraps a Driver with query safety checks and history tracking.
type Client struct {
	driver  Driver
	history *History
}

// NewClient creates a database client wrapping the given driver.
func NewClient(driver Driver) *Client {
	return &Client{
		driver:  driver,
		history: NewHistory(),
	}
}

// ListSchemas delegates to the driver.
func (c *Client) ListSchemas(ctx context.Context) ([]Schema, error) {
	return c.driver.ListSchemas(ctx)
}

// ListTables delegates to the driver.
func (c *Client) ListTables(ctx context.Context, schema string) ([]TableSummary, error) {
	return c.driver.ListTables(ctx, schema)
}

// GetTableDetail delegates to the driver.
func (c *Client) GetTableDetail(ctx context.Context, schema, table string) (*TableDetail, error) {
	return c.driver.GetTableDetail(ctx, schema, table)
}

// ExecuteQuery runs a query with DDL blocking, timeout, and history recording.
func (c *Client) ExecuteQuery(ctx context.Context, sql string, timeout time.Duration, maxRows int) (*QueryResult, error) {
	// Check for DDL statements before execution
	if err := CheckDDL(sql); err != nil {
		c.history.Add(QueryHistoryEntry{
			SQL:        sql,
			ExecutedAt: time.Now(),
			Error:      err.Error(),
		})
		return nil, err
	}

	result, err := c.driver.ExecuteQuery(ctx, sql, timeout, maxRows)

	entry := QueryHistoryEntry{
		SQL:        sql,
		ExecutedAt: time.Now(),
	}
	if err != nil {
		entry.Error = err.Error()
	} else {
		entry.ExecutionTimeMs = result.ExecutionTimeMs
		entry.RowCount = result.RowCount
	}
	c.history.Add(entry)

	if err != nil {
		return nil, fmt.Errorf("execute query: %w", err)
	}
	return result, nil
}

// GetQueryHistory returns the query history entries.
func (c *Client) GetQueryHistory() []QueryHistoryEntry {
	return c.history.List()
}

// Ping delegates to the driver for health checks.
func (c *Client) Ping(ctx context.Context) error {
	return c.driver.Ping(ctx)
}

// Close delegates to the driver.
func (c *Client) Close() error {
	return c.driver.Close()
}
