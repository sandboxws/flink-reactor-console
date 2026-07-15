package fluss

import (
	"context"
	"regexp"
	"strings"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

// Patterns to extract Fluss table references from pipeline SQL.
//
// We only care about three-part identifiers `<catalog>.<database>.<table>`
// where the catalog is registered with `'connector' = 'fluss'`. Two-part
// references against the current catalog are intentionally skipped: without
// session state we can't tell whether they target Fluss or some other
// connector, so we leave them for the catalog-introspection layer.
var (
	flussConnectorPattern = regexp.MustCompile(`(?i)'connector'\s*=\s*'fluss'`)
	createCatalogFluss    = regexp.MustCompile(`(?is)CREATE\s+CATALOG\s+` + "`?" + `([a-zA-Z0-9_]+)` + "`?" + `\s+WITH\s*\([^)]*?'type'\s*=\s*'fluss'[^)]*\)`)
	threePartRef          = regexp.MustCompile("`?([a-zA-Z0-9_]+)`?\\.`?([a-zA-Z0-9_]+)`?\\.`?([a-zA-Z0-9_]+)`?")
)

// HighlightResources finds Fluss tables referenced in pipeline SQL.
//
// Lookup proceeds in two passes:
//  1. Extract the set of Fluss catalog names registered in the SQL — either
//     via `CREATE CATALOG <name> WITH ('type' = 'fluss', ...)` or via a
//     CREATE TABLE block whose property bag contains `'connector' = 'fluss'`.
//  2. Scan the SQL for three-part identifiers; emit a ResourceRef for any
//     reference whose catalog name is in the Fluss catalog set.
//
// We do NOT cross-check against the live cluster — the spec wants the route
// URL emitted for any reference, and the dashboard handles "table missing on
// cluster" downstream when the user actually navigates.
func (i *Instrument) HighlightResources(_ context.Context, pipelineSQL string) ([]instruments.ResourceRef, error) {
	if i.client == nil {
		return nil, nil
	}

	flussCatalogs := extractFlussCatalogs(pipelineSQL)
	if len(flussCatalogs) == 0 {
		return nil, nil
	}

	type ref struct {
		database, table, role string
	}
	seen := make(map[ref]struct{})

	roleHints := extractRoleHints(pipelineSQL)

	for _, m := range threePartRef.FindAllStringSubmatch(pipelineSQL, -1) {
		catalog, database, table := m[1], m[2], m[3]
		if _, ok := flussCatalogs[catalog]; !ok {
			continue
		}
		role := roleHints[m[0]]
		if role == "" {
			role = "source"
		}
		seen[ref{database: database, table: table, role: role}] = struct{}{}
	}

	out := make([]instruments.ResourceRef, 0, len(seen))
	for r := range seen {
		out = append(out, instruments.ResourceRef{
			Name:             r.database + "." + r.table,
			Role:             r.role,
			PipelineRelevant: true,
		})
	}
	return out, nil
}

// extractFlussCatalogs returns the set of catalog names declared with
// `'type' = 'fluss'` (typed CREATE CATALOG) or `'connector' = 'fluss'`
// (CREATE TABLE WITH connector property).
func extractFlussCatalogs(sql string) map[string]struct{} {
	out := make(map[string]struct{})

	for _, m := range createCatalogFluss.FindAllStringSubmatch(sql, -1) {
		out[m[1]] = struct{}{}
	}

	// Tables declared with connector='fluss' don't always have a CREATE
	// CATALOG counterpart in the pipeline (the catalog may be in init.sql).
	// In that case we still want to surface refs that quote the same catalog
	// name as the table. We treat any three-part ref appearing in the same
	// CREATE TABLE block as belonging to a fluss catalog.
	for chunk := range strings.SplitSeq(sql, "CREATE TABLE") {
		if !flussConnectorPattern.MatchString(chunk) {
			continue
		}
		for _, m := range threePartRef.FindAllStringSubmatch(chunk, -1) {
			out[m[1]] = struct{}{}
		}
	}

	return out
}

// extractRoleHints scans the SQL for `INSERT INTO <ref>` and `FROM <ref>`
// clauses and returns a map keyed by the matched literal (preserving any
// backticks) so the role can be recovered when the matcher revisits the ref
// during the highlight pass.
func extractRoleHints(sql string) map[string]string {
	out := make(map[string]string)

	insertRe := regexp.MustCompile(`(?i)\bINSERT\s+INTO\s+(` + "`?" + `[a-zA-Z0-9_]+` + "`?" + `\.` + "`?" + `[a-zA-Z0-9_]+` + "`?" + `\.` + "`?" + `[a-zA-Z0-9_]+` + "`?" + `)`)
	fromRe := regexp.MustCompile(`(?i)\bFROM\s+(` + "`?" + `[a-zA-Z0-9_]+` + "`?" + `\.` + "`?" + `[a-zA-Z0-9_]+` + "`?" + `\.` + "`?" + `[a-zA-Z0-9_]+` + "`?" + `)`)

	for _, m := range insertRe.FindAllStringSubmatch(sql, -1) {
		out[m[1]] = "sink"
	}
	for _, m := range fromRe.FindAllStringSubmatch(sql, -1) {
		if _, ok := out[m[1]]; !ok {
			out[m[1]] = "source"
		}
	}
	return out
}
