// Package catalogs provides catalog browsing via the Flink SQL Gateway.
package catalogs

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// CatalogInfo represents a registered Flink catalog.
type CatalogInfo struct {
	Name string
}

// CatalogDatabase represents a database within a catalog.
type CatalogDatabase struct {
	Name string
}

// CatalogTable represents a table within a catalog database.
type CatalogTable struct {
	Name string
}

// Service provides catalog browsing operations via the SQL Gateway.
// It manages per-cluster sessions internally, creating on first use and
// recreating on expiry.
type Service struct {
	manager  *cluster.Manager
	mu       sync.Mutex
	sessions map[string]string // cluster name → session handle
}

// NewService creates a new catalog service.
func NewService(manager *cluster.Manager) *Service {
	return &Service{
		manager:  manager,
		sessions: make(map[string]string),
	}
}

// ListCatalogs returns all registered catalogs for the given cluster.
func (s *Service) ListCatalogs(ctx context.Context, clusterName *string) ([]CatalogInfo, error) {
	rows, err := s.executeWithRecovery(ctx, clusterName, "SHOW CATALOGS")
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
		catalogs = append(catalogs, CatalogInfo{Name: name})
	}
	return catalogs, nil
}

// ListDatabases returns all databases in the given catalog.
func (s *Service) ListDatabases(ctx context.Context, catalog string, clusterName *string) ([]CatalogDatabase, error) {
	stmt := fmt.Sprintf("SHOW DATABASES IN `%s`", catalog)
	rows, err := s.executeWithRecovery(ctx, clusterName, stmt)
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

// ListTables returns all tables in the given catalog and database.
func (s *Service) ListTables(ctx context.Context, catalog, database string, clusterName *string) ([]CatalogTable, error) {
	stmt := fmt.Sprintf("SHOW TABLES IN `%s`.`%s`", catalog, database)
	rows, err := s.executeWithRecovery(ctx, clusterName, stmt)
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

// executeWithRecovery executes a statement using a cached session.
// If the session has expired, it creates a new one and retries.
func (s *Service) executeWithRecovery(ctx context.Context, clusterName *string, statement string) ([][]any, error) {
	conn, err := s.manager.Resolve(clusterName)
	if err != nil {
		return nil, err
	}
	if conn.SQLClient == nil {
		return nil, fmt.Errorf("SQL Gateway not configured for cluster %q", conn.Name)
	}

	sessionHandle, err := s.getOrCreateSession(ctx, conn)
	if err != nil {
		return nil, err
	}

	rows, err := s.submitAndFetch(ctx, conn.SQLClient, sessionHandle, statement)
	if err != nil {
		// Check if the session expired (404 from SQL Gateway).
		if isSessionNotFound(err) {
			s.invalidateSession(conn.Name)
			sessionHandle, err = s.createSession(ctx, conn)
			if err != nil {
				return nil, err
			}
			return s.submitAndFetch(ctx, conn.SQLClient, sessionHandle, statement)
		}
		return nil, err
	}
	return rows, nil
}

// getOrCreateSession returns a cached session handle or creates a new one.
func (s *Service) getOrCreateSession(ctx context.Context, conn *cluster.Connection) (string, error) {
	s.mu.Lock()
	handle, ok := s.sessions[conn.Name]
	s.mu.Unlock()

	if ok {
		return handle, nil
	}
	return s.createSession(ctx, conn)
}

// createSession creates a new SQL Gateway session and caches it.
func (s *Service) createSession(ctx context.Context, conn *cluster.Connection) (string, error) {
	var session flink.SQLGatewaySessionResponse
	if err := conn.SQLClient.PostJSON(ctx, "/v3/sessions", map[string]any{}, &session); err != nil {
		return "", fmt.Errorf("creating catalog session: %w", err)
	}

	s.mu.Lock()
	s.sessions[conn.Name] = session.SessionHandle
	s.mu.Unlock()

	return session.SessionHandle, nil
}

// invalidateSession removes a cached session for the given cluster.
func (s *Service) invalidateSession(clusterName string) {
	s.mu.Lock()
	delete(s.sessions, clusterName)
	s.mu.Unlock()
}

// submitAndFetch submits a statement and fetches all result rows.
func (s *Service) submitAndFetch(ctx context.Context, client *flink.Client, sessionHandle, statement string) ([][]any, error) {
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

	rows := make([][]any, len(resultSet.Data))
	for i, row := range resultSet.Data {
		rows[i] = row.Fields
	}
	return rows, nil
}

// isSessionNotFound checks if an error is a 404 from the SQL Gateway,
// indicating the session has expired or been closed.
func isSessionNotFound(err error) bool {
	var apiErr *flink.APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode == 404
	}
	return false
}
