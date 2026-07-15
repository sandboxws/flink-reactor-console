// Package datalake implements the Datalake instrument for browsing data lake
// catalogs (Apache Iceberg via REST, Apache Paimon via filesystem or Hive
// metastore) and surfacing format-specific table metadata, snapshots, and
// storage metrics to the console.
package datalake

import (
	"context"
	"encoding/json"
	"fmt"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

const instrumentVersion = "0.1.0"

// Instrument implements the instruments.Instrument interface for data lake
// catalogs. The active backend depends on the configured CatalogType.
type Instrument struct {
	name    string
	cfg     Config
	iceberg *IcebergClient
	paimon  *PaimonClient
}

// NewInstrument creates a Datalake instrument with the given instance name.
func NewInstrument(name string) *Instrument {
	return &Instrument{name: name}
}

// Name returns the unique instance name.
func (i *Instrument) Name() string { return i.name }

// DisplayName returns a human-readable name.
func (i *Instrument) DisplayName() string { return i.name }

// Version returns the instrument version.
func (i *Instrument) Version() string { return instrumentVersion }

// Type returns the instrument type identifier.
func (i *Instrument) Type() string { return "datalake" }

// Capabilities returns the list of supported capabilities. Datalake supports
// browsing namespaces/tables and reporting storage metrics.
func (i *Instrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{
		instruments.CapabilityBrowse,
		instruments.CapabilityMetrics,
	}
}

// Config returns the resolved configuration. Useful for resolvers that need to
// inspect the catalog type before dispatching.
func (i *Instrument) Config() Config { return i.cfg }

// IcebergClient returns the Iceberg REST client when the instrument is
// configured for iceberg-rest, otherwise nil.
func (i *Instrument) IcebergClient() *IcebergClient { return i.iceberg }

// PaimonClient returns the Paimon filesystem client when the instrument is
// configured for paimon-fs, otherwise nil.
func (i *Instrument) PaimonClient() *PaimonClient { return i.paimon }

// Init parses the config, validates it, and constructs the appropriate
// backend client. The backend is not eagerly contacted here — callers should
// use HealthCheck for that.
func (i *Instrument) Init(_ context.Context, cfg json.RawMessage) error {
	var dc Config
	if err := json.Unmarshal(cfg, &dc); err != nil {
		return fmt.Errorf("invalid datalake config: %w", err)
	}
	if err := dc.Validate(); err != nil {
		return err
	}
	i.cfg = dc

	switch dc.CatalogType {
	case CatalogIcebergREST:
		c, err := NewIcebergClient(dc.Endpoint, dc.Properties)
		if err != nil {
			return fmt.Errorf("iceberg client init failed: %w", err)
		}
		i.iceberg = c
	case CatalogPaimonFS:
		c, err := NewPaimonClient(dc.Warehouse)
		if err != nil {
			return fmt.Errorf("paimon client init failed: %w", err)
		}
		i.paimon = c
	case CatalogPaimonHive:
		// Hive Metastore Thrift is intentionally minimal here — we verify
		// reachability in HealthCheck via TCP dial. A full Thrift client is
		// future work; resolvers that need Paimon-Hive metadata can read the
		// warehouse path directly via PaimonClient if Warehouse is provided.
		if dc.Warehouse != "" {
			c, err := NewPaimonClient(dc.Warehouse)
			if err == nil {
				i.paimon = c
			}
		}
	}
	return nil
}

// Shutdown releases any resources held by the active backend client.
func (i *Instrument) Shutdown(_ context.Context) error {
	if i.iceberg != nil {
		return i.iceberg.Close()
	}
	return nil
}

// HighlightResources is currently a no-op for the datalake instrument.
//
// Iceberg/Paimon table references in Flink SQL surface as ordinary catalog
// table names (e.g. `my_catalog.db.tbl`), which the SQL gateway already
// resolves through its catalog list. Highlighting would duplicate that work,
// so the datalake instrument does not advertise CapabilityHighlight.
func (i *Instrument) HighlightResources(_ context.Context, _ string) ([]instruments.ResourceRef, error) {
	return nil, nil
}
