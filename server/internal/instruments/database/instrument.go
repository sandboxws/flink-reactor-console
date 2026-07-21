// Package database implements the database instrument for schema browsing and query execution.
package database

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

const instrumentVersion = "0.1.0"

const (
	defaultStatementTimeout = 30 // seconds
	defaultMaxRows          = 10000
)

// Config is the JSON config schema for the database instrument.
type Config struct {
	DSN              string `json:"dsn"`
	Driver           string `json:"driver"` // "postgres" or "mysql"
	StatementTimeout int    `json:"statementTimeout"`
	MaxRows          int    `json:"maxRows"`
}

// Instrument implements the instruments.Instrument interface for databases.
type Instrument struct {
	name             string
	instrumentType   string
	logger           *slog.Logger
	client           *Client
	statementTimeout time.Duration
	maxRows          int
}

// NewInstrument creates a database instrument with the given instance name.
func NewInstrument(name string, logger *slog.Logger) *Instrument {
	return newInstrument(name, "database", logger)
}

// NewYugabyteInstrument creates a YugabyteDB instrument. YugabyteDB's YSQL API is
// PostgreSQL-wire-compatible, so it reuses this instrument's Postgres engine
// (schema browsing, query execution, DDL highlighting) verbatim and differs only
// by the reported Type(). That lets the dashboard present YugabyteDB as its own
// system while every database* GraphQL resolver keeps working — those resolvers
// type-assert *database.Instrument, not the type string.
func NewYugabyteInstrument(name string, logger *slog.Logger) *Instrument {
	return newInstrument(name, "yugabyte", logger)
}

func newInstrument(name, instrumentType string, logger *slog.Logger) *Instrument {
	return &Instrument{name: name, instrumentType: instrumentType, logger: logger}
}

// Name returns the unique instance name.
func (i *Instrument) Name() string { return i.name }

// DisplayName returns a human-readable name.
func (i *Instrument) DisplayName() string { return i.name }

// Version returns the instrument version.
func (i *Instrument) Version() string { return instrumentVersion }

// Type returns the instrument type identifier ("database" or "yugabyte").
func (i *Instrument) Type() string { return i.instrumentType }

// Capabilities returns the list of supported capabilities.
func (i *Instrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{
		instruments.CapabilityBrowse,
		instruments.CapabilityHighlight,
	}
}

// Init parses the config and establishes a database connection.
func (i *Instrument) Init(ctx context.Context, cfg json.RawMessage) error {
	var dc Config
	if err := json.Unmarshal(cfg, &dc); err != nil {
		return fmt.Errorf("invalid database config: %w", err)
	}

	if dc.DSN == "" {
		return fmt.Errorf("database config: dsn required")
	}

	// YugabyteDB speaks the PostgreSQL wire protocol (YSQL); when a yugabyte
	// instrument omits an explicit driver, default it to the Postgres dialect.
	if dc.Driver == "" && i.instrumentType == "yugabyte" {
		dc.Driver = "yugabyte"
	}

	var driver Driver
	switch dc.Driver {
	case "postgres", "yugabyte":
		driver = &PostgresDriver{}
	case "mysql":
		driver = &MySQLDriver{}
	default:
		return fmt.Errorf("unsupported database driver: %q (supported: postgres, yugabyte, mysql)", dc.Driver)
	}

	if err := driver.Connect(ctx, dc.DSN); err != nil {
		return fmt.Errorf("database driver connect: %w", err)
	}

	i.client = NewClient(driver)

	i.statementTimeout = time.Duration(dc.StatementTimeout) * time.Second
	if i.statementTimeout == 0 {
		i.statementTimeout = defaultStatementTimeout * time.Second
	}

	i.maxRows = dc.MaxRows
	if i.maxRows == 0 {
		i.maxRows = defaultMaxRows
	}

	i.logger.Info(
		"database instrument initialized",
		"name", i.name,
		"driver", dc.Driver,
		"timeout", i.statementTimeout,
		"maxRows", i.maxRows,
	)
	return nil
}

// Shutdown closes the database connection.
func (i *Instrument) Shutdown(_ context.Context) error {
	if i.client != nil {
		return i.client.Close()
	}
	return nil
}

// HealthCheck verifies database connectivity.
func (i *Instrument) HealthCheck(ctx context.Context) error {
	if i.client == nil {
		return fmt.Errorf("database client not initialized")
	}
	return i.client.Ping(ctx)
}

// Client returns the underlying database client for use by resolvers.
func (i *Instrument) Client() *Client {
	return i.client
}

// StatementTimeout returns the configured statement timeout.
func (i *Instrument) StatementTimeout() time.Duration {
	return i.statementTimeout
}

// MaxRows returns the configured maximum row limit.
func (i *Instrument) MaxRows() int {
	return i.maxRows
}
