package datalake

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// IcebergClient talks to an Iceberg REST Catalog v1 server.
//
// Spec reference: https://iceberg.apache.org/docs/latest/spec/#rest-catalog
type IcebergClient struct {
	baseURL    string
	httpClient *http.Client
	headers    map[string]string
}

// NewIcebergClient creates a client for the given REST catalog base URL. The
// optional properties map is passed through to outgoing requests as headers
// (e.g. `token` -> `Authorization: Bearer <token>`).
func NewIcebergClient(baseURL string, props map[string]string) (*IcebergClient, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("iceberg endpoint required")
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("invalid iceberg endpoint: %q", baseURL)
	}

	headers := make(map[string]string)
	if tok, ok := props["token"]; ok && tok != "" {
		headers["Authorization"] = "Bearer " + tok
	}

	return &IcebergClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 15 * time.Second},
		headers:    headers,
	}, nil
}

// Close releases idle HTTP connections.
func (c *IcebergClient) Close() error {
	if t, ok := c.httpClient.Transport.(*http.Transport); ok {
		t.CloseIdleConnections()
	}
	return nil
}

// get performs an authenticated GET and decodes JSON into out (if non-nil).
func (c *IcebergClient) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(req) //nolint:gosec // G704: baseURL is an operator-configured instrument endpoint, not request-derived input
	if err != nil {
		return fmt.Errorf("iceberg request %s: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("iceberg GET %s: %d %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// PingConfig calls GET /v1/config; used by HealthCheck. The endpoint is
// always present on a conforming REST catalog.
func (c *IcebergClient) PingConfig(ctx context.Context) error {
	return c.get(ctx, "/v1/config", nil)
}

// ListNamespaces returns all top-level namespaces. Iceberg REST returns a
// list of multi-part identifiers; we flatten each one with `.` as separator.
func (c *IcebergClient) ListNamespaces(ctx context.Context) ([]string, error) {
	var resp struct {
		Namespaces [][]string `json:"namespaces"`
	}
	if err := c.get(ctx, "/v1/namespaces", &resp); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(resp.Namespaces))
	for _, ns := range resp.Namespaces {
		out = append(out, strings.Join(ns, "."))
	}
	return out, nil
}

// ListTables returns table names within the given namespace. The namespace
// argument may be a multi-part identifier ("a.b") which we URL-encode using
// the REST catalog's "%1F" (unit separator) part delimiter.
func (c *IcebergClient) ListTables(ctx context.Context, namespace string) ([]string, error) {
	var resp struct {
		Identifiers []struct {
			Namespace []string `json:"namespace"`
			Name      string   `json:"name"`
		} `json:"identifiers"`
	}
	path := fmt.Sprintf("/v1/namespaces/%s/tables", encodeNamespace(namespace))
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(resp.Identifiers))
	for _, id := range resp.Identifiers {
		out = append(out, id.Name)
	}
	return out, nil
}

// rawTableMetadata mirrors the on-the-wire shape returned by GET tables.
// We keep this private and translate into our cleaner IcebergTableMeta.
type rawTableMetadata struct {
	Metadata struct {
		FormatVersion     int    `json:"format-version"`
		TableUUID         string `json:"table-uuid"`
		Location          string `json:"location"`
		LastUpdatedMs     int64  `json:"last-updated-ms"`
		CurrentSnapshotID *int64 `json:"current-snapshot-id"`
		Schemas           []struct {
			SchemaID         int   `json:"schema-id"`
			IdentifierFields []int `json:"identifier-field-ids"`
			Fields           []struct {
				ID       int             `json:"id"`
				Name     string          `json:"name"`
				Required bool            `json:"required"`
				Type     json.RawMessage `json:"type"`
				Doc      string          `json:"doc"`
			} `json:"fields"`
		} `json:"schemas"`
		CurrentSchemaID int `json:"current-schema-id"`
		PartitionSpecs  []struct {
			SpecID int `json:"spec-id"`
			Fields []struct {
				SourceID  int    `json:"source-id"`
				FieldID   int    `json:"field-id"`
				Name      string `json:"name"`
				Transform string `json:"transform"`
			} `json:"fields"`
		} `json:"partition-specs"`
		DefaultSpecID int `json:"default-spec-id"`
		Snapshots     []struct {
			SnapshotID   int64             `json:"snapshot-id"`
			ParentID     *int64            `json:"parent-snapshot-id"`
			TimestampMs  int64             `json:"timestamp-ms"`
			ManifestList string            `json:"manifest-list"`
			Summary      map[string]string `json:"summary"`
		} `json:"snapshots"`
		Properties map[string]string `json:"properties"`
	} `json:"metadata"`
}

// GetTableMetadata fetches and parses table metadata from the REST catalog.
func (c *IcebergClient) GetTableMetadata(ctx context.Context, namespace, table string) (*IcebergTableMeta, error) {
	var raw rawTableMetadata
	path := fmt.Sprintf("/v1/namespaces/%s/tables/%s", encodeNamespace(namespace), url.PathEscape(table))
	if err := c.get(ctx, path, &raw); err != nil {
		return nil, err
	}

	meta := &IcebergTableMeta{
		FormatVersion:     raw.Metadata.FormatVersion,
		UUID:              raw.Metadata.TableUUID,
		Location:          raw.Metadata.Location,
		CurrentSnapshotID: raw.Metadata.CurrentSnapshotID,
		Properties:        raw.Metadata.Properties,
	}

	// Resolve the current schema.
	for _, s := range raw.Metadata.Schemas {
		if s.SchemaID != raw.Metadata.CurrentSchemaID {
			continue
		}
		fields := make([]SchemaField, len(s.Fields))
		for i, f := range s.Fields {
			fields[i] = SchemaField{
				ID:       f.ID,
				Name:     f.Name,
				Type:     icebergTypeName(f.Type),
				Required: f.Required,
				Doc:      f.Doc,
			}
		}
		pks := make([]string, 0, len(s.IdentifierFields))
		fieldByID := make(map[int]string, len(s.Fields))
		for _, f := range s.Fields {
			fieldByID[f.ID] = f.Name
		}
		for _, id := range s.IdentifierFields {
			if name, ok := fieldByID[id]; ok {
				pks = append(pks, name)
			}
		}
		meta.Schema = SchemaInfo{SchemaID: s.SchemaID, Fields: fields, PrimaryKeys: pks}
		break
	}

	// Resolve the default partition spec.
	for _, ps := range raw.Metadata.PartitionSpecs {
		if ps.SpecID != raw.Metadata.DefaultSpecID {
			continue
		}
		fields := make([]PartitionField, len(ps.Fields))
		for i, f := range ps.Fields {
			fields[i] = PartitionField{
				SourceID:  f.SourceID,
				FieldID:   f.FieldID,
				Name:      f.Name,
				Transform: f.Transform,
			}
		}
		meta.PartitionSpec = PartitionSpec{SpecID: ps.SpecID, Fields: fields}
		break
	}

	// Snapshots — chronological order.
	snaps := make([]Snapshot, len(raw.Metadata.Snapshots))
	for i, s := range raw.Metadata.Snapshots {
		op := ""
		if s.Summary != nil {
			op = s.Summary["operation"]
		}
		snaps[i] = Snapshot{
			SnapshotID:   s.SnapshotID,
			ParentID:     s.ParentID,
			TimestampMs:  s.TimestampMs,
			Operation:    op,
			Summary:      s.Summary,
			ManifestList: s.ManifestList,
		}
	}
	meta.Snapshots = snaps

	return meta, nil
}

// GetSnapshots returns the snapshot history extracted from table metadata.
// Snapshots are returned in the order the catalog reports them, which for
// Iceberg is chronological (oldest → newest).
func (c *IcebergClient) GetSnapshots(ctx context.Context, namespace, table string) ([]Snapshot, error) {
	meta, err := c.GetTableMetadata(ctx, namespace, table)
	if err != nil {
		return nil, err
	}
	return meta.Snapshots, nil
}

// GetStorageMetrics returns size and file counts derived from the current
// snapshot's summary fields. Iceberg writers populate these on every commit;
// for tables without summaries we return zero counts rather than failing.
func (c *IcebergClient) GetStorageMetrics(ctx context.Context, namespace, table string) (*StorageMetrics, error) {
	meta, err := c.GetTableMetadata(ctx, namespace, table)
	if err != nil {
		return nil, err
	}

	out := &StorageMetrics{}
	if meta.CurrentSnapshotID == nil {
		return out, nil
	}
	for _, s := range meta.Snapshots {
		if s.SnapshotID != *meta.CurrentSnapshotID {
			continue
		}
		out.TotalSizeBytes = parseSummaryInt(s.Summary, "total-files-size")
		out.DataFileCount = int(parseSummaryInt(s.Summary, "total-data-files"))
		out.DeleteFileCount = int(parseSummaryInt(s.Summary, "total-delete-files"))
		// Iceberg reports manifest count via "total-manifests" on some writers
		// and "manifests" on others; check both.
		mf := parseSummaryInt(s.Summary, "total-manifests")
		if mf == 0 {
			mf = parseSummaryInt(s.Summary, "manifests")
		}
		out.ManifestFileCount = int(mf)
		break
	}
	return out, nil
}

// encodeNamespace URL-encodes a namespace for the REST path. Iceberg uses
// "%1F" (unit separator) between parts; we use it here when the namespace
// contains "." separators.
func encodeNamespace(ns string) string {
	parts := strings.Split(ns, ".")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "%1F")
}

// icebergTypeName flattens the Iceberg type JSON (which can be a primitive
// string like `"long"` or a struct/list/map object) into a display string.
func icebergTypeName(raw json.RawMessage) string {
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var obj struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil && obj.Type != "" {
		return obj.Type
	}
	return string(raw)
}

// parseSummaryInt reads an integer-valued field from a snapshot summary map.
// Iceberg encodes everything as strings on the wire.
func parseSummaryInt(summary map[string]string, key string) int64 {
	if summary == nil {
		return 0
	}
	v, ok := summary[key]
	if !ok {
		return 0
	}
	var n int64
	_, _ = fmt.Sscanf(v, "%d", &n)
	return n
}
