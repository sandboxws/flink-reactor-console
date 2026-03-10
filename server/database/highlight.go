package database

import (
	"context"
	"regexp"
	"strings"

	instruments "github.com/sandboxws/flink-reactor-instruments"
)

// Patterns to extract table references from Flink SQL.
// Matches identifiers in FROM/INTO clauses and 'table-name' connector property.
var (
	fromPattern          = regexp.MustCompile(`(?i)\bFROM\s+` + "`?" + `([a-zA-Z0-9_.-]+)` + "`?")
	insertIntoPattern    = regexp.MustCompile(`(?i)\bINSERT\s+INTO\s+` + "`?" + `([a-zA-Z0-9_.-]+)` + "`?")
	tableNamePropPattern = regexp.MustCompile(`(?i)'table-name'\s*=\s*'([^']+)'`)
)

// tableNameLister is implemented by drivers that can list table names.
type tableNameLister interface {
	TableNames(ctx context.Context) ([]string, error)
}

// HighlightResources identifies database tables referenced in pipeline SQL.
func (i *Instrument) HighlightResources(ctx context.Context, pipelineSQL string) ([]instruments.ResourceRef, error) {
	if i.client == nil {
		return nil, nil
	}

	lister, ok := i.client.driver.(tableNameLister)
	if !ok {
		return nil, nil
	}

	tableNames, err := lister.TableNames(ctx)
	if err != nil {
		return nil, err
	}

	knownTables := make(map[string]bool, len(tableNames))
	for _, name := range tableNames {
		knownTables[name] = true
		// Also index by unqualified table name (without schema prefix)
		parts := strings.SplitN(name, ".", 2)
		if len(parts) == 2 {
			knownTables[parts[1]] = true
		}
	}

	// Extract identifiers from SQL
	refs := extractDBRefsFromSQL(pipelineSQL)

	// Match against known tables
	var result []instruments.ResourceRef
	for name, role := range refs {
		if knownTables[name] {
			result = append(result, instruments.ResourceRef{
				Name:             name,
				Role:             role,
				PipelineRelevant: true,
			})
		}
	}

	return result, nil
}

// extractDBRefsFromSQL extracts table name -> role mappings from Flink SQL.
func extractDBRefsFromSQL(sql string) map[string]string {
	refs := make(map[string]string)

	for _, match := range fromPattern.FindAllStringSubmatch(sql, -1) {
		refs[match[1]] = "source"
	}
	for _, match := range insertIntoPattern.FindAllStringSubmatch(sql, -1) {
		refs[match[1]] = "sink"
	}
	// JDBC connector 'table-name' property
	for _, match := range tableNamePropPattern.FindAllStringSubmatch(sql, -1) {
		if _, exists := refs[match[1]]; !exists {
			refs[match[1]] = "source"
		}
	}

	return refs
}

// matchAgainstTables filters refs to only those matching known tables.
func matchAgainstTables(refs map[string]string, tables []string) []instruments.ResourceRef {
	known := make(map[string]bool, len(tables))
	for _, t := range tables {
		known[t] = true
		// Also match unqualified name
		parts := strings.SplitN(t, ".", 2)
		if len(parts) == 2 {
			known[parts[1]] = true
		}
	}

	var result []instruments.ResourceRef
	for name, role := range refs {
		if known[name] {
			result = append(result, instruments.ResourceRef{
				Name:             name,
				Role:             role,
				PipelineRelevant: true,
			})
		}
	}
	return result
}
