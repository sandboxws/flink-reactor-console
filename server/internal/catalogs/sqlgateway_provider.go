package catalogs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// SQLGatewayProvider implements CatalogProvider by executing SQL statements
// against the Flink SQL Gateway.
type SQLGatewayProvider struct {
	manager        *cluster.Manager
	logger         *slog.Logger
	mu             sync.Mutex
	sessions       map[string]string // cluster name → session handle
	initSQLPath    string
	initStatements []string
	initOnce       sync.Once
}

// NewSQLGatewayProvider creates a provider backed by the Flink SQL Gateway.
// initSQLPath is optional — when set, DDL from the file is executed on every
// new session to register catalogs and tables.
func NewSQLGatewayProvider(manager *cluster.Manager, initSQLPath string, logger *slog.Logger) *SQLGatewayProvider {
	return &SQLGatewayProvider{
		manager:     manager,
		logger:      logger,
		sessions:    make(map[string]string),
		initSQLPath: initSQLPath,
	}
}

// InitStatements returns the cached init SQL statements, loading the file on
// first call. Returns nil if no init SQL is configured or the file is absent.
func (p *SQLGatewayProvider) InitStatements() []string {
	p.loadInitSQL()
	return p.initStatements
}

// loadInitSQL reads the init SQL file once and caches the parsed statements.
func (p *SQLGatewayProvider) loadInitSQL() {
	p.initOnce.Do(func() {
		if p.initSQLPath == "" {
			return
		}
		data, err := os.ReadFile(p.initSQLPath)
		if err != nil {
			if os.IsNotExist(err) {
				p.logger.Warn("init SQL file not found, continuing without init SQL",
					"path", p.initSQLPath)
				return
			}
			p.logger.Error("failed to read init SQL file",
				"path", p.initSQLPath, "error", err)
			return
		}
		p.initStatements = splitStatements(string(data))
		p.logger.Info("loaded init SQL", "path", p.initSQLPath, "statements", len(p.initStatements))
	})
}

// splitStatements splits SQL text on semicolons, trims whitespace, and filters empty entries.
func splitStatements(sql string) []string {
	parts := strings.Split(sql, ";")
	stmts := make([]string, 0, len(parts))
	for _, part := range parts {
		s := strings.TrimSpace(part)
		if s != "" {
			stmts = append(stmts, s)
		}
	}
	return stmts
}

// ListCatalogs returns catalogs via SHOW CATALOGS.
func (p *SQLGatewayProvider) ListCatalogs(ctx context.Context) ([]CatalogInfo, error) {
	rows, err := p.executeWithRecovery(ctx, nil, "SHOW CATALOGS")
	if err != nil {
		return nil, fmt.Errorf("listing catalogs: %w", err)
	}

	catalogs := make([]CatalogInfo, 0, len(rows))
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		name, ok := row[0].(string)
		if !ok {
			continue
		}
		catalogs = append(catalogs, CatalogInfo{Name: name, Source: "live"})
	}
	return catalogs, nil
}

// ListDatabases returns databases via SHOW DATABASES IN.
func (p *SQLGatewayProvider) ListDatabases(ctx context.Context, catalog string) ([]CatalogDatabase, error) {
	stmt := fmt.Sprintf("SHOW DATABASES IN `%s`", catalog)
	rows, err := p.executeWithRecovery(ctx, nil, stmt)
	if err != nil {
		return nil, fmt.Errorf("listing databases in catalog %q: %w", catalog, err)
	}

	databases := make([]CatalogDatabase, 0, len(rows))
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		name, ok := row[0].(string)
		if !ok {
			continue
		}
		databases = append(databases, CatalogDatabase{Name: name})
	}
	return databases, nil
}

// ListTables returns tables via SHOW TABLES IN.
func (p *SQLGatewayProvider) ListTables(ctx context.Context, catalog, database string) ([]CatalogTable, error) {
	stmt := fmt.Sprintf("SHOW TABLES IN `%s`.`%s`", catalog, database)
	rows, err := p.executeWithRecovery(ctx, nil, stmt)
	if err != nil {
		return nil, fmt.Errorf("listing tables in %q.%q: %w", catalog, database, err)
	}

	tables := make([]CatalogTable, 0, len(rows))
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		name, ok := row[0].(string)
		if !ok {
			continue
		}
		tables = append(tables, CatalogTable{Name: name})
	}
	return tables, nil
}

// ListColumns returns column metadata via DESCRIBE.
func (p *SQLGatewayProvider) ListColumns(ctx context.Context, catalog, database, table string) ([]ColumnInfo, error) {
	stmt := fmt.Sprintf("DESCRIBE `%s`.`%s`.`%s`", catalog, database, table)
	rows, err := p.executeWithRecovery(ctx, nil, stmt)
	if err != nil {
		return nil, fmt.Errorf("describing %q.%q.%q: %w", catalog, database, table, err)
	}

	columns := make([]ColumnInfo, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		name, ok := row[0].(string)
		if !ok {
			continue
		}
		colType, ok := row[1].(string)
		if !ok {
			continue
		}
		columns = append(columns, ColumnInfo{Name: name, Type: colType})
	}
	return columns, nil
}

// executeWithRecovery executes a statement using a cached session.
// If the session has expired, it creates a new one (with init SQL) and retries.
func (p *SQLGatewayProvider) executeWithRecovery(ctx context.Context, clusterName *string, statement string) ([][]any, error) {
	conn, err := p.manager.Resolve(clusterName)
	if err != nil {
		return nil, err
	}
	if conn.SQLClient == nil {
		return nil, fmt.Errorf("SQL Gateway not configured for cluster %q", conn.Name)
	}

	sessionHandle, err := p.getOrCreateSession(ctx, conn)
	if err != nil {
		return nil, err
	}

	rows, err := p.submitAndFetch(ctx, conn.SQLClient, sessionHandle, statement)
	if err != nil {
		if isSessionNotFound(err) {
			p.invalidateSession(conn.Name)
			sessionHandle, err = p.createSession(ctx, conn)
			if err != nil {
				return nil, err
			}
			return p.submitAndFetch(ctx, conn.SQLClient, sessionHandle, statement)
		}
		return nil, err
	}
	return rows, nil
}

func (p *SQLGatewayProvider) getOrCreateSession(ctx context.Context, conn *cluster.Connection) (string, error) {
	p.mu.Lock()
	handle, ok := p.sessions[conn.Name]
	p.mu.Unlock()

	if ok {
		return handle, nil
	}
	return p.createSession(ctx, conn)
}

func (p *SQLGatewayProvider) createSession(ctx context.Context, conn *cluster.Connection) (string, error) {
	var session flink.SQLGatewaySessionResponse
	if err := conn.SQLClient.PostJSON(ctx, "/v3/sessions", map[string]any{}, &session); err != nil {
		return "", fmt.Errorf("creating catalog session: %w", err)
	}

	// Execute init SQL DDL statements so catalogs/tables are visible in this session.
	p.loadInitSQL()
	for _, stmt := range p.initStatements {
		var op flink.SQLGatewayOperationResponse
		body := map[string]string{"statement": stmt}
		submitPath := fmt.Sprintf("/v3/sessions/%s/statements", session.SessionHandle)
		if submitErr := conn.SQLClient.PostJSON(ctx, submitPath, body, &op); submitErr != nil {
			continue
		}
		fetchPath := fmt.Sprintf("/v3/sessions/%s/operations/%s/result/0",
			session.SessionHandle, op.OperationHandle)
		var rs flink.SQLGatewayResultSet
		_ = conn.SQLClient.GetJSON(ctx, fetchPath, &rs)
	}

	p.mu.Lock()
	p.sessions[conn.Name] = session.SessionHandle
	p.mu.Unlock()

	return session.SessionHandle, nil
}

func (p *SQLGatewayProvider) invalidateSession(clusterName string) {
	p.mu.Lock()
	delete(p.sessions, clusterName)
	p.mu.Unlock()
}

func (p *SQLGatewayProvider) submitAndFetch(ctx context.Context, client *flink.Client, sessionHandle, statement string) ([][]any, error) {
	var op flink.SQLGatewayOperationResponse
	body := map[string]string{"statement": statement}
	submitPath := fmt.Sprintf("/v3/sessions/%s/statements", sessionHandle)
	if err := client.PostJSON(ctx, submitPath, body, &op); err != nil {
		return nil, err
	}

	fetchPath := fmt.Sprintf("/v3/sessions/%s/operations/%s/result/0",
		sessionHandle, op.OperationHandle)
	var resultSet flink.SQLGatewayResultSet
	if err := client.GetJSON(ctx, fetchPath, &resultSet); err != nil {
		return nil, err
	}

	rows := make([][]any, len(resultSet.Results.Data))
	for i, row := range resultSet.Results.Data {
		rows[i] = row.Fields
	}
	return rows, nil
}

func isSessionNotFound(err error) bool {
	var apiErr *flink.APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode == 404
	}
	return false
}
