package catalogs

import (
	"context"
	_ "embed"
	"fmt"

	"gopkg.in/yaml.v3"
)

//go:embed bundled_catalogs.yml
var bundledCatalogsYAML []byte

// bundledColumn is the YAML shape for a column definition.
type bundledColumn struct {
	Name string `yaml:"name"`
	Type string `yaml:"type"`
}

// bundledTable is the YAML shape for a table definition.
type bundledTable struct {
	Name    string          `yaml:"name"`
	Columns []bundledColumn `yaml:"columns"`
}

// bundledDatabase is the YAML shape for a database definition.
type bundledDatabase struct {
	Name   string         `yaml:"name"`
	Tables []bundledTable `yaml:"tables"`
}

// bundledConnector defines the Flink connector configuration for a catalog.
type bundledConnector struct {
	Type       string            `yaml:"type"`       // "kafka" or "jdbc"
	Properties map[string]string `yaml:"properties"` // connector-level WITH properties
}

// bundledCatalog is the YAML shape for a catalog definition.
type bundledCatalog struct {
	Name      string            `yaml:"name"`
	Connector bundledConnector  `yaml:"connector"`
	Databases []bundledDatabase `yaml:"databases"`
}

// BundledFile is the top-level YAML structure.
type BundledFile struct {
	Catalogs []bundledCatalog `yaml:"catalogs"`
}

// BundledProvider serves embedded example catalog data.
type BundledProvider struct {
	data BundledFile
}

// Data returns the parsed bundled catalog definitions.
// Used by the Initializer to generate DDL statements.
func (p *BundledProvider) Data() BundledFile {
	return p.data
}

// NewBundledProvider creates a provider backed by the embedded YAML catalog data.
func NewBundledProvider() (*BundledProvider, error) {
	var data BundledFile
	if err := yaml.Unmarshal(bundledCatalogsYAML, &data); err != nil {
		return nil, fmt.Errorf("parsing bundled catalogs YAML: %w", err)
	}
	return &BundledProvider{data: data}, nil
}

// ListCatalogs returns all bundled example catalogs with connector metadata.
func (p *BundledProvider) ListCatalogs(_ context.Context) ([]CatalogInfo, error) {
	result := make([]CatalogInfo, len(p.data.Catalogs))
	for i, c := range p.data.Catalogs {
		tableCount := 0
		for _, db := range c.Databases {
			tableCount += len(db.Tables)
		}
		result[i] = CatalogInfo{
			Name:          c.Name,
			Source:        "bundled",
			ConnectorType: c.Connector.Type,
			Properties:    RedactProperties(c.Connector.Properties),
			DatabaseCount: len(c.Databases),
			TableCount:    tableCount,
		}
	}
	return result, nil
}

// ListDatabases returns databases for a bundled catalog.
func (p *BundledProvider) ListDatabases(_ context.Context, catalog string) ([]CatalogDatabase, error) {
	for _, c := range p.data.Catalogs {
		if c.Name == catalog {
			result := make([]CatalogDatabase, len(c.Databases))
			for i, db := range c.Databases {
				result[i] = CatalogDatabase{Name: db.Name}
			}
			return result, nil
		}
	}
	return nil, nil
}

// ListTables returns tables for a bundled catalog database.
func (p *BundledProvider) ListTables(_ context.Context, catalog, database string) ([]CatalogTable, error) {
	for _, c := range p.data.Catalogs {
		if c.Name != catalog {
			continue
		}
		for _, db := range c.Databases {
			if db.Name == database {
				result := make([]CatalogTable, len(db.Tables))
				for i, t := range db.Tables {
					result[i] = CatalogTable{Name: t.Name}
				}
				return result, nil
			}
		}
	}
	return nil, nil
}

// ListColumns returns column metadata for a bundled table.
func (p *BundledProvider) ListColumns(_ context.Context, catalog, database, table string) ([]ColumnInfo, error) {
	for _, c := range p.data.Catalogs {
		if c.Name != catalog {
			continue
		}
		for _, db := range c.Databases {
			if db.Name != database {
				continue
			}
			for _, t := range db.Tables {
				if t.Name == table {
					result := make([]ColumnInfo, len(t.Columns))
					for i, col := range t.Columns {
						result[i] = ColumnInfo(col)
					}
					return result, nil
				}
			}
		}
	}
	return nil, nil
}

// TableDDL generates a CREATE TABLE statement from the bundled YAML data.
func (p *BundledProvider) TableDDL(_ context.Context, catalog, database, table string) (string, error) {
	for _, c := range p.data.Catalogs {
		if c.Name != catalog {
			continue
		}
		for _, db := range c.Databases {
			if db.Name != database {
				continue
			}
			for _, t := range db.Tables {
				if t.Name == table {
					return generateCreateTable(catalog, database, t, c.Connector), nil
				}
			}
		}
	}
	return "", nil
}
