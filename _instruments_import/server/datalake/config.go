package datalake

import (
	"fmt"
	"strings"
)

// CatalogType selects which datalake catalog backend the instrument talks to.
type CatalogType string

// Supported catalog backend types.
const (
	CatalogIcebergREST CatalogType = "iceberg-rest"
	CatalogPaimonFS    CatalogType = "paimon-fs"
	CatalogPaimonHive  CatalogType = "paimon-hive"
)

// Config is the JSON config schema for the Datalake instrument.
//
// Different catalog types use different fields:
//   - iceberg-rest:  Endpoint  (REST base URL)
//   - paimon-fs:     Warehouse (local or remote filesystem path)
//   - paimon-hive:   Endpoint  (host:port for the Hive Metastore), Warehouse (path)
type Config struct {
	CatalogType CatalogType       `json:"catalogType"`
	Endpoint    string            `json:"endpoint,omitempty"`
	Warehouse   string            `json:"warehouse,omitempty"`
	Properties  map[string]string `json:"properties,omitempty"`
}

// Validate normalizes whitespace and rejects unknown catalog types or missing
// required fields per catalog type.
func (c *Config) Validate() error {
	c.CatalogType = CatalogType(strings.TrimSpace(string(c.CatalogType)))
	c.Endpoint = strings.TrimSpace(c.Endpoint)
	c.Warehouse = strings.TrimSpace(c.Warehouse)

	switch c.CatalogType {
	case CatalogIcebergREST:
		if c.Endpoint == "" {
			return fmt.Errorf("datalake config: endpoint required for catalogType %q", c.CatalogType)
		}
	case CatalogPaimonFS:
		if c.Warehouse == "" {
			return fmt.Errorf("datalake config: warehouse required for catalogType %q", c.CatalogType)
		}
	case CatalogPaimonHive:
		if c.Endpoint == "" {
			return fmt.Errorf("datalake config: endpoint required for catalogType %q", c.CatalogType)
		}
	case "":
		return fmt.Errorf("datalake config: catalogType required")
	default:
		return fmt.Errorf("datalake config: unsupported catalogType %q (want one of: iceberg-rest, paimon-fs, paimon-hive)", c.CatalogType)
	}
	return nil
}
