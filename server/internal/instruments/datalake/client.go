package datalake

import (
	"context"
	"fmt"
	"net"
	"time"
)

// HealthCheck verifies the configured catalog backend is reachable.
//
//   - iceberg-rest:  GET /v1/config (with /v1/namespaces fallback for
//     catalogs that don't implement the optional /v1/config endpoint)
//   - paimon-fs:     stat + read warehouse directory
//   - paimon-hive:   TCP dial to the metastore endpoint
func (i *Instrument) HealthCheck(ctx context.Context) error {
	switch i.cfg.CatalogType {
	case CatalogIcebergREST:
		if i.iceberg == nil {
			return fmt.Errorf("iceberg client not initialized")
		}
		if err := i.iceberg.PingConfig(ctx); err == nil {
			return nil
		}
		// Some REST catalogs don't expose /v1/config; namespaces is mandatory.
		if _, err := i.iceberg.ListNamespaces(ctx); err != nil {
			return fmt.Errorf("iceberg health check failed: %w", err)
		}
		return nil

	case CatalogPaimonFS:
		if i.paimon == nil {
			return fmt.Errorf("paimon client not initialized")
		}
		return i.paimon.CheckWarehouseReadable()

	case CatalogPaimonHive:
		return dialMetastore(ctx, i.cfg.Endpoint)

	default:
		return fmt.Errorf("datalake: unsupported catalogType %q", i.cfg.CatalogType)
	}
}

// dialMetastore performs a short TCP dial to confirm the metastore endpoint
// is reachable. We don't speak Thrift here — full Hive Metastore client
// support is future work.
func dialMetastore(ctx context.Context, endpoint string) error {
	if endpoint == "" {
		return fmt.Errorf("paimon-hive endpoint required")
	}
	d := &net.Dialer{Timeout: 3 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", endpoint)
	if err != nil {
		return fmt.Errorf("hive metastore dial %s: %w", endpoint, err)
	}
	_ = conn.Close()
	return nil
}
