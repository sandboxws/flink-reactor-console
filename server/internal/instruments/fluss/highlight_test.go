package fluss

import (
	"context"
	"strings"
	"testing"
)

// newTestInstrument returns a Fluss Instrument wired to a non-functional
// client. HighlightResources only touches the client to gate its no-op
// behavior — it never makes a network call, so a stub client is fine.
func newTestInstrument(t *testing.T) *Instrument {
	t.Helper()
	i := NewInstrument("fluss-test")
	c, err := NewClient(Config{BootstrapServers: "localhost:9123"})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	i.client = c
	return i
}

func TestHighlightFlussCatalogReference(t *testing.T) {
	i := newTestInstrument(t)
	sql := strings.Join([]string{
		"CREATE CATALOG fluss_catalog WITH (",
		"  'type' = 'fluss',",
		"  'bootstrap.servers' = 'fluss-coordinator:9123'",
		");",
		"CREATE CATALOG paimon_catalog WITH ('type' = 'paimon');",
		"INSERT INTO paimon_catalog.benchmark.orders",
		"SELECT * FROM fluss_catalog.benchmark.orders;",
	}, "\n")

	refs, err := i.HighlightResources(context.Background(), sql)
	if err != nil {
		t.Fatalf("HighlightResources: %v", err)
	}
	if len(refs) != 1 {
		t.Fatalf("expected 1 fluss resource, got %d (%+v)", len(refs), refs)
	}
	got := refs[0]
	if got.Name != "benchmark.orders" {
		t.Errorf("Name: want benchmark.orders, got %q", got.Name)
	}
	if got.Role != "source" {
		t.Errorf("Role: want source, got %q", got.Role)
	}
	if !got.PipelineRelevant {
		t.Errorf("PipelineRelevant: want true")
	}
}

func TestHighlightIgnoresNonFlussCatalogs(t *testing.T) {
	i := newTestInstrument(t)
	sql := strings.Join([]string{
		"CREATE CATALOG paimon_catalog WITH ('type' = 'paimon');",
		"SELECT * FROM paimon_catalog.benchmark.orders;",
	}, "\n")

	refs, err := i.HighlightResources(context.Background(), sql)
	if err != nil {
		t.Fatalf("HighlightResources: %v", err)
	}
	if len(refs) != 0 {
		t.Errorf("expected no fluss refs for paimon-only SQL, got %+v", refs)
	}
}

func TestHighlightConnectorPropertyOnTable(t *testing.T) {
	// Fluss tables are sometimes declared inline via CREATE TABLE with
	// connector='fluss', without a CREATE CATALOG. The highlight pass should
	// still pick those up — the catalog name is whatever the inline table's
	// three-part ref uses.
	i := newTestInstrument(t)
	sql := strings.Join([]string{
		"CREATE TABLE my_fluss.benchmark.orders (",
		"  id BIGINT, region STRING",
		") WITH (",
		"  'connector' = 'fluss',",
		"  'bootstrap.servers' = 'localhost:9123'",
		");",
		"INSERT INTO my_fluss.benchmark.orders SELECT * FROM src;",
	}, "\n")

	refs, err := i.HighlightResources(context.Background(), sql)
	if err != nil {
		t.Fatalf("HighlightResources: %v", err)
	}
	if len(refs) != 1 {
		t.Fatalf("expected 1 fluss resource, got %d (%+v)", len(refs), refs)
	}
	if refs[0].Role != "sink" {
		t.Errorf("Role: want sink (INSERT INTO), got %q", refs[0].Role)
	}
}

func TestHighlightNoCatalogNoMatch(t *testing.T) {
	i := newTestInstrument(t)
	sql := "SELECT * FROM tbl;"
	refs, err := i.HighlightResources(context.Background(), sql)
	if err != nil {
		t.Fatalf("HighlightResources: %v", err)
	}
	if len(refs) != 0 {
		t.Errorf("expected zero refs, got %+v", refs)
	}
}
