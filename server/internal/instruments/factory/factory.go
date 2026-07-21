// Package factory constructs instrument instances from a type string.
//
// It lives in its own leaf package to avoid an import cycle: the instrument
// sub-packages (kafka, database, …) import the parent `instruments` package for
// the Instrument interface, so `instruments` itself cannot import them — but
// this package can import both. Both the server entrypoint (registration) and
// the GraphQL layer (connection testing) build instruments through here.
package factory

import (
	"fmt"
	"log/slog"

	"github.com/sandboxws/flink-reactor-console/server/internal/instruments"
	"github.com/sandboxws/flink-reactor-console/server/internal/instruments/database"
	dlinst "github.com/sandboxws/flink-reactor-console/server/internal/instruments/datalake"
	flussinst "github.com/sandboxws/flink-reactor-console/server/internal/instruments/fluss"
	kafkainst "github.com/sandboxws/flink-reactor-console/server/internal/instruments/kafka"
	redisinst "github.com/sandboxws/flink-reactor-console/server/internal/instruments/redis"
	srinst "github.com/sandboxws/flink-reactor-console/server/internal/instruments/schemaregistry"
)

// New constructs an unstarted instrument of the given type. The caller owns the
// Init → HealthCheck → Shutdown lifecycle. An unknown type returns an error.
func New(typ, name string, logger *slog.Logger) (instruments.Instrument, error) {
	switch typ {
	case "kafka":
		return kafkainst.NewInstrument(name), nil
	case "database":
		return database.NewInstrument(name, logger), nil
	case "yugabyte":
		return database.NewYugabyteInstrument(name, logger), nil
	case "redis":
		return redisinst.NewInstrument(name), nil
	case "schemaregistry":
		return srinst.NewInstrument(name), nil
	case "datalake":
		return dlinst.NewInstrument(name), nil
	case "fluss":
		return flussinst.NewInstrument(name), nil
	default:
		return nil, fmt.Errorf("unknown instrument type %q", typ)
	}
}

// SupportedTypes lists the instrument types New can construct.
func SupportedTypes() []string {
	return []string{
		"kafka",
		"database",
		"yugabyte",
		"redis",
		"schemaregistry",
		"datalake",
		"fluss",
	}
}
