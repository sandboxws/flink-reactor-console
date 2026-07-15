package fluss

// FlussTableType distinguishes the two kinds of tables Fluss supports:
// PrimaryKey tables (KV-style upsert) and Log tables (append-only).
type FlussTableType string

// Supported Fluss table types.
const (
	TableTypePrimaryKey FlussTableType = "PrimaryKey"
	TableTypeLog        FlussTableType = "Log"
)

// SchemaField describes one column in a Fluss table schema.
type SchemaField struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
	Comment  string `json:"comment,omitempty"`
}

// FlussTableSummary is a row in the table list — minimal metadata returned by
// the table-list endpoint without an extra round-trip per table.
type FlussTableSummary struct {
	Database      string         `json:"database"`
	Name          string         `json:"name"`
	TableType     FlussTableType `json:"tableType"`
	BucketCount   int            `json:"bucketCount"`
	BucketKey     []string       `json:"bucketKey,omitempty"`
	PrimaryKey    []string       `json:"primaryKey,omitempty"`
	LastUpdatedMs int64          `json:"lastUpdatedMs"`
}

// FlussTableMetadata is the full table descriptor returned by the table-detail
// endpoint. Includes the schema and connector properties on top of the summary.
type FlussTableMetadata struct {
	Database      string         `json:"database"`
	Name          string         `json:"name"`
	TableType     FlussTableType `json:"tableType"`
	BucketCount   int            `json:"bucketCount"`
	BucketKey     []string       `json:"bucketKey,omitempty"`
	PrimaryKey    []string       `json:"primaryKey,omitempty"`
	Schema        []SchemaField  `json:"schema"`
	Properties    map[string]string `json:"properties,omitempty"`
	Comment       string         `json:"comment,omitempty"`
	LastUpdatedMs int64          `json:"lastUpdatedMs"`
}

// BucketInfo describes one bucket of a Fluss table — leadership and replica
// placement, plus the high-watermark (largest committed offset for Log tables,
// largest write LSN for PrimaryKey tables).
type BucketInfo struct {
	BucketID int   `json:"bucketId"`
	Leader   int   `json:"leader"`
	Replicas []int `json:"replicas"`
	HighWatermark int64 `json:"hwm"`
}

// TabletServerHealth is one row in the tablet-server health grid.
type TabletServerHealth struct {
	Server     string `json:"server"`
	Alive      bool   `json:"alive"`
	Leadership int    `json:"leadership"`
}
