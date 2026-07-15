package datalake

// SchemaField describes one column in a table schema.
type SchemaField struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
	Doc      string `json:"doc,omitempty"`
}

// SchemaInfo is a backend-agnostic representation of a table schema.
type SchemaInfo struct {
	SchemaID    int           `json:"schemaId"`
	Fields      []SchemaField `json:"fields"`
	PrimaryKeys []string      `json:"primaryKeys,omitempty"`
}

// PartitionField is one entry in a partition spec.
type PartitionField struct {
	SourceID  int    `json:"sourceId"`
	FieldID   int    `json:"fieldId"`
	Name      string `json:"name"`
	Transform string `json:"transform"`
}

// PartitionSpec describes how a table is partitioned.
type PartitionSpec struct {
	SpecID int              `json:"specId"`
	Fields []PartitionField `json:"fields"`
}

// Snapshot is a point-in-time table state. Used by both Iceberg and Paimon.
type Snapshot struct {
	SnapshotID  int64             `json:"snapshotId"`
	ParentID    *int64            `json:"parentId,omitempty"`
	TimestampMs int64             `json:"timestampMs"`
	Operation   string            `json:"operation"`
	Summary     map[string]string `json:"summary,omitempty"`
	ManifestList string           `json:"manifestList,omitempty"`
}

// StorageMetrics summarizes storage usage for a table.
type StorageMetrics struct {
	TotalSizeBytes    int64 `json:"totalSizeBytes"`
	DataFileCount     int   `json:"dataFileCount"`
	ManifestFileCount int   `json:"manifestFileCount"`
	DeleteFileCount   int   `json:"deleteFileCount"`
}

// IcebergTableMeta is the Iceberg-specific table metadata bundle.
type IcebergTableMeta struct {
	FormatVersion     int               `json:"formatVersion"`
	UUID              string            `json:"uuid,omitempty"`
	Location          string            `json:"location"`
	CurrentSnapshotID *int64            `json:"currentSnapshotId,omitempty"`
	Schema            SchemaInfo        `json:"schema"`
	PartitionSpec     PartitionSpec     `json:"partitionSpec"`
	Snapshots         []Snapshot        `json:"snapshots"`
	Properties        map[string]string `json:"properties,omitempty"`
}

// PaimonTableMeta is the Paimon-specific table config bundle.
type PaimonTableMeta struct {
	Location      string            `json:"location"`
	BucketCount   int               `json:"bucketCount"`
	ChangelogMode string            `json:"changelogMode,omitempty"`
	MergeEngine   string            `json:"mergeEngine,omitempty"`
	Schema        SchemaInfo        `json:"schema"`
	Properties    map[string]string `json:"properties,omitempty"`
}

// TableMetadata is a unified, backend-agnostic table descriptor returned by
// the instrument. Exactly one of Iceberg or Paimon is set, matching the
// instrument's catalog type.
type TableMetadata struct {
	Format    string            `json:"format"`
	Namespace string            `json:"namespace"`
	Name      string            `json:"name"`
	Schema    SchemaInfo        `json:"schema"`
	Iceberg   *IcebergTableMeta `json:"iceberg,omitempty"`
	Paimon    *PaimonTableMeta  `json:"paimon,omitempty"`
}
