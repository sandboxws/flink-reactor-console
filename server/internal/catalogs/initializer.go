package catalogs

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// Initializer registers bundled catalog tables in Flink via the SQL Gateway.
// It generates and executes CREATE CATALOG, CREATE DATABASE, and CREATE TABLE
// statements so that bundled example tables are queryable through Flink SQL.
type Initializer struct {
	data   BundledFile
	client *flink.Client
	logger *slog.Logger
}

// NewInitializer creates a catalog initializer that registers bundled tables
// in Flink via the given SQL Gateway client.
func NewInitializer(data BundledFile, client *flink.Client, logger *slog.Logger) *Initializer {
	return &Initializer{
		data:   data,
		client: client,
		logger: logger,
	}
}

// Initialize creates a SQL Gateway session and executes all DDL statements
// to register bundled catalogs, databases, and tables in Flink.
func (i *Initializer) Initialize(ctx context.Context) error {
	sessionHandle, err := i.createSession(ctx)
	if err != nil {
		return fmt.Errorf("creating init session: %w", err)
	}

	stmts := i.GenerateSQL()
	i.logger.Info("initializing bundled catalogs", "statements", len(stmts))

	for _, stmt := range stmts {
		if err := i.executeStatement(ctx, sessionHandle, stmt); err != nil {
			// Log and continue — "already exists" or partial failures
			// should not prevent other catalogs from being registered.
			i.logger.Warn("catalog init statement failed",
				"statement", truncate(stmt, 120),
				"error", err,
			)
			continue
		}
	}

	i.logger.Info("bundled catalog initialization complete")
	return nil
}

// GenerateSQL produces the ordered list of DDL statements needed to register
// all bundled catalogs, databases, and tables in Flink.
func (i *Initializer) GenerateSQL() []string {
	var stmts []string
	for _, cat := range i.data.Catalogs {
		stmts = append(stmts, generateCreateCatalog(cat.Name))
		for _, db := range cat.Databases {
			stmts = append(stmts, generateCreateDatabase(cat.Name, db.Name))
			for _, tbl := range db.Tables {
				stmts = append(stmts, generateCreateTable(cat.Name, db.Name, tbl, cat.Connector))
			}
		}
	}
	return stmts
}

func generateCreateCatalog(name string) string {
	return fmt.Sprintf("CREATE CATALOG `%s` WITH ('type' = 'generic_in_memory')", name)
}

func generateCreateDatabase(catalog, database string) string {
	return fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`.`%s`", catalog, database)
}

func generateCreateTable(catalog, database string, table bundledTable, conn bundledConnector) string {
	var b strings.Builder

	// Column definitions
	fmt.Fprintf(&b, "CREATE TABLE IF NOT EXISTS `%s`.`%s`.`%s` (\n", catalog, database, table.Name)
	for idx, col := range table.Columns {
		fmt.Fprintf(&b, "  `%s` %s", col.Name, col.Type)
		if idx < len(table.Columns)-1 {
			b.WriteByte(',')
		}
		b.WriteByte('\n')
	}
	b.WriteString(") WITH (\n")

	// Build WITH properties: connector type + per-table key + catalog-level props
	props := make(map[string]string)
	props["connector"] = conn.Type
	for k, v := range conn.Properties {
		props[k] = v
	}

	// Per-table connector-specific properties
	switch conn.Type {
	case "kafka":
		props["topic"] = table.Name
	case "jdbc":
		props["table-name"] = table.Name
	}

	// Sort keys for deterministic output
	keys := make([]string, 0, len(props))
	for k := range props {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for idx, k := range keys {
		fmt.Fprintf(&b, "  '%s' = '%s'", k, props[k])
		if idx < len(keys)-1 {
			b.WriteByte(',')
		}
		b.WriteByte('\n')
	}
	b.WriteByte(')')

	return b.String()
}

func (i *Initializer) createSession(ctx context.Context) (string, error) {
	var session flink.SQLGatewaySessionResponse
	if err := i.client.PostJSON(ctx, "/v3/sessions", map[string]any{}, &session); err != nil {
		return "", err
	}
	return session.SessionHandle, nil
}

func (i *Initializer) executeStatement(ctx context.Context, sessionHandle, statement string) error {
	var op flink.SQLGatewayOperationResponse
	body := map[string]string{"statement": statement}
	submitPath := fmt.Sprintf("/v3/sessions/%s/statements", sessionHandle)
	if err := i.client.PostJSON(ctx, submitPath, body, &op); err != nil {
		return err
	}

	// Fetch result to ensure statement completed (DDL is synchronous).
	fetchPath := fmt.Sprintf("/v3/sessions/%s/operations/%s/result/0",
		sessionHandle, op.OperationHandle)
	var resultSet flink.SQLGatewayResultSet
	return i.client.GetJSON(ctx, fetchPath, &resultSet)
}

func truncate(s string, maxLen int) string {
	// Collapse whitespace for log readability.
	s = strings.Join(strings.Fields(s), " ")
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
