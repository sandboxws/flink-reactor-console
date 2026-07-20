package config

import (
	"os"
	"path/filepath"
	"testing"
)

// TestLoadDevelopmentDefaultInstruments verifies that development synthesizes
// the default instrument set (tagged development) when none are declared.
func TestLoadDevelopmentDefaultInstruments(t *testing.T) {
	// loadClean clears REACTOR_ENV/APP_ENV → development, and the empty temp dir
	// declares no instruments, so the dev defaults apply.
	cfg := loadClean(t)

	if !cfg.IsDevelopment() {
		t.Fatalf("environment = %q, want development", cfg.App.Environment)
	}
	if len(cfg.Instruments) == 0 {
		t.Fatal("expected synthesized default development instruments")
	}

	types := map[string]bool{}
	for _, in := range cfg.Instruments {
		types[in.Type] = true
		if in.Environment != "development" {
			t.Errorf("default instrument %q environment = %q, want development",
				in.Name, in.Environment)
		}
	}
	for _, want := range []string{"kafka", "database", "schemaregistry", "fluss", "datalake"} {
		if !types[want] {
			t.Errorf("missing default %q instrument", want)
		}
	}
	if !SeedingAllowed(cfg.App.Environment, "development", cfg.Seeding.Enabled) {
		t.Error("expected seeding allowed for a dev instrument in development")
	}
}

// TestLoadStagingNoDefaultsAndSeedingFlag verifies staging loads the seeding
// opt-in flag, synthesizes no default instruments, and still blocks production.
func TestLoadStagingNoDefaultsAndSeedingFlag(t *testing.T) {
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "config")
	if err := os.MkdirAll(configDir, 0o750); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(configDir, "staging.yml"),
		[]byte("seeding:\n  enabled: true\n"),
		0o600,
	); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(origDir)
	})

	t.Setenv("APP_ENV", "")
	t.Setenv("FLINK_AUTH_TOKEN", "")
	t.Setenv("REACTOR_ENV", "staging")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load(staging) error: %v", err)
	}

	if cfg.App.Environment != "staging" {
		t.Errorf("environment = %q, want staging", cfg.App.Environment)
	}
	if len(cfg.Instruments) != 0 {
		t.Errorf("staging synthesized %d instruments, want 0 (dev-only)", len(cfg.Instruments))
	}
	if !cfg.Seeding.Enabled {
		t.Error("Seeding.Enabled = false, want true (parsed from staging.yml)")
	}
	if !SeedingAllowed(cfg.App.Environment, "staging", cfg.Seeding.Enabled) {
		t.Error("expected staging seeding allowed with the flag on")
	}
	if SeedingAllowed(cfg.App.Environment, "production", cfg.Seeding.Enabled) {
		t.Error("staging must never seed a production-tagged instrument")
	}
}
