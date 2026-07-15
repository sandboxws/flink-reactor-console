package datalake

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{"empty type rejected", Config{}, true},
		{"unknown type rejected", Config{CatalogType: "delta-rest"}, true},
		{"iceberg-rest needs endpoint", Config{CatalogType: CatalogIcebergREST}, true},
		{"iceberg-rest valid", Config{CatalogType: CatalogIcebergREST, Endpoint: "http://x"}, false},
		{"paimon-fs needs warehouse", Config{CatalogType: CatalogPaimonFS}, true},
		{"paimon-fs valid", Config{CatalogType: CatalogPaimonFS, Warehouse: "/wh"}, false},
		{"paimon-hive needs endpoint", Config{CatalogType: CatalogPaimonHive}, true},
		{"paimon-hive valid", Config{CatalogType: CatalogPaimonHive, Endpoint: "host:9083"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() err = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestInstrumentInitIcebergREST(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"defaults": map[string]string{}})
	}))
	defer srv.Close()

	inst := NewInstrument("dl-1")
	cfg, _ := json.Marshal(map[string]any{"catalogType": "iceberg-rest", "endpoint": srv.URL})
	if err := inst.Init(context.Background(), cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if inst.IcebergClient() == nil {
		t.Error("IcebergClient should be set")
	}
	if inst.PaimonClient() != nil {
		t.Error("PaimonClient should be nil for iceberg-rest")
	}
	if inst.Type() != "datalake" {
		t.Errorf("Type: want datalake, got %s", inst.Type())
	}
}

func TestInstrumentInitPaimonFS(t *testing.T) {
	wh := t.TempDir()
	inst := NewInstrument("dl-2")
	cfg, _ := json.Marshal(map[string]any{"catalogType": "paimon-fs", "warehouse": wh})
	if err := inst.Init(context.Background(), cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if inst.PaimonClient() == nil {
		t.Error("PaimonClient should be set")
	}
}

func TestInstrumentInitRejectsInvalidConfig(t *testing.T) {
	inst := NewInstrument("dl-bad")
	if err := inst.Init(context.Background(), []byte(`{"catalogType":"not-a-type"}`)); err == nil {
		t.Error("expected error for invalid catalogType")
	}
}

func TestHealthCheckIcebergUnreachable(t *testing.T) {
	inst := NewInstrument("dl-3")
	cfg, _ := json.Marshal(map[string]any{"catalogType": "iceberg-rest", "endpoint": "http://127.0.0.1:1"})
	_ = inst.Init(context.Background(), cfg)
	if err := inst.HealthCheck(context.Background()); err == nil {
		t.Error("expected health check to fail for unreachable iceberg")
	}
}

func TestHealthCheckPaimonFSReachable(t *testing.T) {
	wh := t.TempDir()
	inst := NewInstrument("dl-4")
	cfg, _ := json.Marshal(map[string]any{"catalogType": "paimon-fs", "warehouse": wh})
	_ = inst.Init(context.Background(), cfg)
	if err := inst.HealthCheck(context.Background()); err != nil {
		t.Errorf("HealthCheck on valid warehouse: %v", err)
	}
}

func TestHealthCheckPaimonHiveUnreachable(t *testing.T) {
	inst := NewInstrument("dl-5")
	cfg, _ := json.Marshal(map[string]any{"catalogType": "paimon-hive", "endpoint": "127.0.0.1:1"})
	_ = inst.Init(context.Background(), cfg)
	if err := inst.HealthCheck(context.Background()); err == nil {
		t.Error("expected health check to fail for unreachable hive metastore")
	}
}

func TestTableMetadataDiscriminator(t *testing.T) {
	// Iceberg-shaped TableMetadata
	ice := &IcebergTableMeta{Location: "s3://x"}
	tm := TableMetadata{Format: "iceberg", Iceberg: ice}
	if tm.Iceberg == nil || tm.Paimon != nil {
		t.Errorf("iceberg discriminator: %+v", tm)
	}

	// Paimon-shaped
	pm := &PaimonTableMeta{Location: "/wh/db.db/t", BucketCount: 4}
	tm2 := TableMetadata{Format: "paimon", Paimon: pm}
	if tm2.Paimon == nil || tm2.Iceberg != nil {
		t.Errorf("paimon discriminator: %+v", tm2)
	}
	if tm2.Paimon.BucketCount != 4 {
		t.Errorf("BucketCount round-trip: %d", tm2.Paimon.BucketCount)
	}
}

func TestInstrumentCapabilities(t *testing.T) {
	inst := NewInstrument("dl")
	caps := inst.Capabilities()
	wantBrowse := false
	wantMetrics := false
	for _, c := range caps {
		if string(c) == "browse" {
			wantBrowse = true
		}
		if string(c) == "metrics" {
			wantMetrics = true
		}
	}
	if !wantBrowse || !wantMetrics {
		t.Errorf("Capabilities: want browse+metrics, got %v", caps)
	}
}
