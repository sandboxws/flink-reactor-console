package materialized

import (
	"context"
	"fmt"
	"strings"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// Service provides materialized table operations via the SQL Gateway REST API.
// It manages SQL Gateway sessions internally for each operation.
type Service struct {
	client *flink.Client
}

// NewService creates a new materialized table service.
// Returns nil if the client is nil (SQL Gateway not configured).
func NewService(client *flink.Client) *Service {
	if client == nil {
		return nil
	}
	return &Service{client: client}
}

// ListTables executes SHOW MATERIALIZED TABLES and returns table names.
func (s *Service) ListTables(ctx context.Context, catalog string) ([]Table, error) {
	stmt := "SHOW MATERIALIZED TABLES"
	if catalog != "" {
		stmt = fmt.Sprintf("USE CATALOG `%s`;\n%s", catalog, stmt)
	}

	rows, err := s.executeAndFetch(ctx, stmt)
	if err != nil {
		return nil, fmt.Errorf("listing materialized tables: %w", err)
	}

	tables := make([]Table, 0, len(rows))
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		name, ok := row[0].(string)
		if !ok {
			continue
		}
		tables = append(tables, Table{
			Name:    name,
			Catalog: catalog,
		})
	}
	return tables, nil
}

// GetTable executes DESCRIBE MATERIALIZED TABLE and returns table metadata.
func (s *Service) GetTable(ctx context.Context, name, catalog string) (*Table, error) {
	qualifiedName := fmt.Sprintf("`%s`.`%s`", catalog, name)
	stmt := fmt.Sprintf("DESCRIBE MATERIALIZED TABLE %s", qualifiedName)

	rows, err := s.executeAndFetch(ctx, stmt)
	if err != nil {
		return nil, fmt.Errorf("describing materialized table %s: %w", name, err)
	}

	table := &Table{
		Name:    name,
		Catalog: catalog,
	}

	// Parse DESCRIBE output — field mapping depends on Flink version.
	// Common columns: name, refresh_status, refresh_mode, freshness, definition.
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		key := strings.ToLower(fmt.Sprintf("%v", row[0]))
		val := fmt.Sprintf("%v", row[1])

		switch key {
		case "refresh_status", "refreshstatus":
			table.RefreshStatus = RefreshStatus(strings.ToUpper(val))
		case "refresh_mode", "refreshmode":
			table.RefreshMode = val
		case "freshness":
			table.Freshness = val
		case "definition", "defining_query", "definingquery":
			table.DefiningQuery = val
		case "database":
			table.Database = val
		}
	}

	return table, nil
}

// SuspendTable executes ALTER MATERIALIZED TABLE ... SUSPEND.
func (s *Service) SuspendTable(ctx context.Context, name, catalog string) (*Table, error) {
	qualifiedName := fmt.Sprintf("`%s`.`%s`", catalog, name)
	stmt := fmt.Sprintf("ALTER MATERIALIZED TABLE %s SUSPEND", qualifiedName)

	if _, err := s.executeAndFetch(ctx, stmt); err != nil {
		return nil, fmt.Errorf("suspending materialized table %s: %w", name, err)
	}

	return s.GetTable(ctx, name, catalog)
}

// ResumeTable executes ALTER MATERIALIZED TABLE ... RESUME.
func (s *Service) ResumeTable(ctx context.Context, name, catalog string) (*Table, error) {
	qualifiedName := fmt.Sprintf("`%s`.`%s`", catalog, name)
	stmt := fmt.Sprintf("ALTER MATERIALIZED TABLE %s RESUME", qualifiedName)

	if _, err := s.executeAndFetch(ctx, stmt); err != nil {
		return nil, fmt.Errorf("resuming materialized table %s: %w", name, err)
	}

	return s.GetTable(ctx, name, catalog)
}

// RefreshTable executes ALTER MATERIALIZED TABLE ... REFRESH.
func (s *Service) RefreshTable(ctx context.Context, name, catalog string) (*Table, error) {
	qualifiedName := fmt.Sprintf("`%s`.`%s`", catalog, name)
	stmt := fmt.Sprintf("ALTER MATERIALIZED TABLE %s REFRESH", qualifiedName)

	if _, err := s.executeAndFetch(ctx, stmt); err != nil {
		return nil, fmt.Errorf("refreshing materialized table %s: %w", name, err)
	}

	return s.GetTable(ctx, name, catalog)
}

// executeAndFetch manages a SQL Gateway session, submits a statement, fetches
// all results, and closes the session.
func (s *Service) executeAndFetch(ctx context.Context, statement string) ([][]any, error) {
	// 1. Create session
	var session flink.SQLGatewaySessionResponse
	if err := s.client.PostJSON(ctx, "/v3/sessions", map[string]any{}, &session); err != nil {
		return nil, fmt.Errorf("creating session: %w", err)
	}

	// Always close the session when done.
	defer func() {
		closePath := fmt.Sprintf("/v3/sessions/%s", session.SessionHandle)
		_ = s.client.Delete(ctx, closePath)
	}()

	// 2. Submit statement
	var op flink.SQLGatewayOperationResponse
	body := map[string]string{"statement": statement}
	submitPath := fmt.Sprintf("/v3/sessions/%s/statements", session.SessionHandle)
	if err := s.client.PostJSON(ctx, submitPath, body, &op); err != nil {
		return nil, fmt.Errorf("submitting statement: %w", err)
	}

	// 3. Fetch results
	fetchPath := fmt.Sprintf("/v3/sessions/%s/operations/%s/result/0",
		session.SessionHandle, op.OperationHandle)
	var resultSet flink.SQLGatewayResultSet
	if err := s.client.GetJSON(ctx, fetchPath, &resultSet); err != nil {
		return nil, fmt.Errorf("fetching results: %w", err)
	}

	rows := make([][]any, len(resultSet.Results.Data))
	for i, row := range resultSet.Results.Data {
		rows[i] = row.Fields
	}

	return rows, nil
}
