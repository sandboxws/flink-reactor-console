package datalake

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

// PaimonClient reads Apache Paimon table metadata from a warehouse directory.
// It implements only the file-format reads that the console needs (schema,
// table config, snapshot list); rewriting/compaction is out of scope.
//
// Layout (Paimon 0.6+):
//
//	{warehouse}/{db}.db/{table}/schema/schema-{n}     # JSON schema versions
//	{warehouse}/{db}.db/{table}/snapshot/snapshot-{n} # JSON snapshot files
//	{warehouse}/{db}.db/{table}/snapshot/LATEST       # text file with latest n
type PaimonClient struct {
	warehouse string
}

// NewPaimonClient validates that the warehouse path exists and returns a
// reader rooted at it.
func NewPaimonClient(warehouse string) (*PaimonClient, error) {
	if warehouse == "" {
		return nil, fmt.Errorf("paimon warehouse path required")
	}
	clean := filepath.Clean(warehouse)
	info, err := os.Stat(clean)
	if err != nil {
		return nil, fmt.Errorf("paimon warehouse %q: %w", clean, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("paimon warehouse %q is not a directory", clean)
	}
	return &PaimonClient{warehouse: clean}, nil
}

// Warehouse returns the configured warehouse root.
func (p *PaimonClient) Warehouse() string { return p.warehouse }

// tableDir returns the absolute path to a Paimon table directory.
func (p *PaimonClient) tableDir(database, table string) string {
	return filepath.Join(p.warehouse, database+".db", table)
}

// rawPaimonSchema mirrors the on-disk Paimon schema-N JSON document.
type rawPaimonSchema struct {
	ID     int `json:"id"`
	Fields []struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		Type        string `json:"type"`
		Description string `json:"description"`
	} `json:"fields"`
	HighestFieldID int               `json:"highestFieldId"`
	PartitionKeys  []string          `json:"partitionKeys"`
	PrimaryKeys    []string          `json:"primaryKeys"`
	Options        map[string]string `json:"options"`
	Comment        string            `json:"comment"`
	TimeMillis     int64             `json:"timeMillis"`
}

// GetTableSchema reads and parses the most recent schema-N file under the
// table's schema/ directory.
func (p *PaimonClient) GetTableSchema(_ context.Context, database, table string) (*SchemaInfo, error) {
	raw, err := p.latestSchema(database, table)
	if err != nil {
		return nil, err
	}
	return rawSchemaToInfo(raw), nil
}

// GetTableConfig returns Paimon-specific table metadata (bucket count,
// changelog mode, merge engine) extracted from the latest schema's options.
func (p *PaimonClient) GetTableConfig(_ context.Context, database, table string) (*PaimonTableMeta, error) {
	raw, err := p.latestSchema(database, table)
	if err != nil {
		return nil, err
	}
	bucket := 0
	if v, ok := raw.Options["bucket"]; ok {
		if n, err := strconv.Atoi(v); err == nil {
			bucket = n
		}
	}
	return &PaimonTableMeta{
		Location:      p.tableDir(database, table),
		BucketCount:   bucket,
		ChangelogMode: raw.Options["changelog-producer"],
		MergeEngine:   raw.Options["merge-engine"],
		Schema:        *rawSchemaToInfo(raw),
		Properties:    raw.Options,
	}, nil
}

// rawPaimonSnapshot is a minimal subset of a Paimon snapshot-N file. Paimon
// includes more fields; we read what we need for the listing.
type rawPaimonSnapshot struct {
	Version              int               `json:"version"`
	ID                   int64             `json:"id"`
	SchemaID             int               `json:"schemaId"`
	BaseManifestList     string            `json:"baseManifestList"`
	DeltaManifestList    string            `json:"deltaManifestList"`
	CommitUser           string            `json:"commitUser"`
	CommitIdentifier     int64             `json:"commitIdentifier"`
	CommitKind           string            `json:"commitKind"`
	TimeMillis           int64             `json:"timeMillis"`
	TotalRecordCount     int64             `json:"totalRecordCount"`
	DeltaRecordCount     int64             `json:"deltaRecordCount"`
	ChangelogRecordCount int64             `json:"changelogRecordCount"`
	Properties           map[string]string `json:"properties"`
}

// ListSnapshots returns all snapshots in chronological order (lowest ID
// first). Returns an empty slice if the table has no snapshots yet.
func (p *PaimonClient) ListSnapshots(_ context.Context, database, table string) ([]Snapshot, error) {
	dir := filepath.Join(p.tableDir(database, table), "snapshot")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read paimon snapshot dir: %w", err)
	}

	var ids []int64
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, "snapshot-") {
			continue
		}
		idStr := strings.TrimPrefix(name, "snapshot-")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	slices.Sort(ids)

	out := make([]Snapshot, 0, len(ids))
	for _, id := range ids {
		var raw rawPaimonSnapshot
		path := filepath.Join(dir, fmt.Sprintf("snapshot-%d", id))
		data, err := os.ReadFile(path) //nolint:gosec // G304: dir is the operator-configured warehouse; leaf name is int64-formatted
		if err != nil {
			return nil, fmt.Errorf("read snapshot-%d: %w", id, err)
		}
		if err := json.Unmarshal(data, &raw); err != nil {
			return nil, fmt.Errorf("parse snapshot-%d: %w", id, err)
		}
		summary := map[string]string{
			"commitUser":           raw.CommitUser,
			"commitKind":           raw.CommitKind,
			"totalRecordCount":     strconv.FormatInt(raw.TotalRecordCount, 10),
			"deltaRecordCount":     strconv.FormatInt(raw.DeltaRecordCount, 10),
			"changelogRecordCount": strconv.FormatInt(raw.ChangelogRecordCount, 10),
		}
		out = append(out, Snapshot{
			SnapshotID:  raw.ID,
			TimestampMs: raw.TimeMillis,
			Operation:   raw.CommitKind,
			Summary:     summary,
		})
	}
	return out, nil
}

// CheckWarehouseReadable verifies the warehouse directory is statable and
// readable; used by HealthCheck for paimon-fs.
func (p *PaimonClient) CheckWarehouseReadable() error {
	info, err := os.Stat(p.warehouse)
	if err != nil {
		return fmt.Errorf("paimon warehouse stat: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("paimon warehouse %q is not a directory", p.warehouse)
	}
	// Confirm we can read entries — `os.Open` + `Readdirnames(1)` is enough.
	dh, err := os.Open(p.warehouse)
	if err != nil {
		return fmt.Errorf("paimon warehouse open: %w", err)
	}
	defer func() { _ = dh.Close() }()
	if _, err := dh.Readdirnames(1); err != nil && err.Error() != "EOF" {
		return fmt.Errorf("paimon warehouse readdir: %w", err)
	}
	return nil
}

// latestSchema reads the highest-numbered schema-N file under the table.
func (p *PaimonClient) latestSchema(database, table string) (*rawPaimonSchema, error) {
	dir := filepath.Join(p.tableDir(database, table), "schema")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read paimon schema dir: %w", err)
	}

	latest := -1
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, "schema-") {
			continue
		}
		n, err := strconv.Atoi(strings.TrimPrefix(name, "schema-"))
		if err != nil {
			continue
		}
		if n > latest {
			latest = n
		}
	}
	if latest < 0 {
		return nil, fmt.Errorf("no schema files in %s", dir)
	}

	data, err := os.ReadFile(filepath.Join(dir, fmt.Sprintf("schema-%d", latest))) //nolint:gosec // G304: dir is the operator-configured warehouse; leaf name is int64-formatted
	if err != nil {
		return nil, fmt.Errorf("read schema-%d: %w", latest, err)
	}
	var raw rawPaimonSchema
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse schema-%d: %w", latest, err)
	}
	return &raw, nil
}

// rawSchemaToInfo translates the on-disk schema into the unified SchemaInfo.
func rawSchemaToInfo(raw *rawPaimonSchema) *SchemaInfo {
	fields := make([]SchemaField, len(raw.Fields))
	primaryKeys := make(map[string]struct{}, len(raw.PrimaryKeys))
	for _, pk := range raw.PrimaryKeys {
		primaryKeys[pk] = struct{}{}
	}
	for i, f := range raw.Fields {
		_, isPK := primaryKeys[f.Name]
		fields[i] = SchemaField{
			ID:       f.ID,
			Name:     f.Name,
			Type:     f.Type,
			Required: isPK,
			Doc:      f.Description,
		}
	}
	return &SchemaInfo{
		SchemaID:    raw.ID,
		Fields:      fields,
		PrimaryKeys: append([]string(nil), raw.PrimaryKeys...),
	}
}
