package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// loadClean calls Load() from a temp directory with no config files,
// ensuring only defaults take effect.
func loadClean(t *testing.T) *Config {
	t.Helper()

	// Run from a temp dir so no YAML files are found.
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(origDir)
	})

	// Clear env vars that could interfere.
	for _, key := range []string{
		"REACTOR_ENV", "APP_ENV", "FLINK_AUTH_TOKEN",
	} {
		t.Setenv(key, "")
	}

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	return cfg
}

// loadWithYAML creates a temp directory with a development.yml config file
// and calls Load() from there.
func loadWithYAML(t *testing.T, yamlContent string) *Config {
	t.Helper()

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "config")
	if err := os.MkdirAll(configDir, 0o750); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(filepath.Join(configDir, "development.yml"), []byte(yamlContent), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(origDir)
	})

	for _, key := range []string{
		"REACTOR_ENV", "APP_ENV", "FLINK_AUTH_TOKEN",
	} {
		t.Setenv(key, "")
	}

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	return cfg
}

func TestLoadDefaults(t *testing.T) {
	cfg := loadClean(t)

	// App defaults.
	if cfg.App.Name != "reactor-server" {
		t.Errorf("App.Name = %q, want %q", cfg.App.Name, "reactor-server")
	}
	if cfg.App.Environment != "development" {
		t.Errorf("App.Environment = %q, want %q", cfg.App.Environment, "development")
	}
	if cfg.App.Debug {
		t.Error("App.Debug = true, want false")
	}

	// Server defaults.
	if cfg.Server.Host != "0.0.0.0" {
		t.Errorf("Server.Host = %q, want %q", cfg.Server.Host, "0.0.0.0")
	}
	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want %d", cfg.Server.Port, 8080)
	}

	// Flink defaults.
	if cfg.Flink.RestURL != "http://localhost:8081" {
		t.Errorf("Flink.RestURL = %q, want %q", cfg.Flink.RestURL, "http://localhost:8081")
	}
	if cfg.Flink.SQLGatewayURL != "" {
		t.Errorf("Flink.SQLGatewayURL = %q, want empty", cfg.Flink.SQLGatewayURL)
	}
	if cfg.Flink.InitSQLPath != "" {
		t.Errorf("Flink.InitSQLPath = %q, want empty", cfg.Flink.InitSQLPath)
	}

	// Health defaults.
	if cfg.Health.Interval != 30*time.Second {
		t.Errorf("Health.Interval = %v, want %v", cfg.Health.Interval, 30*time.Second)
	}

	// Log defaults.
	if cfg.Log.Level != "info" {
		t.Errorf("Log.Level = %q, want %q", cfg.Log.Level, "info")
	}

	// Clusters should have a default single-cluster entry.
	if len(cfg.Clusters) != 1 {
		t.Fatalf("len(Clusters) = %d, want 1", len(cfg.Clusters))
	}
	if cfg.Clusters[0].Name != "default" {
		t.Errorf("Clusters[0].Name = %q, want %q", cfg.Clusters[0].Name, "default")
	}
}

func TestDetectEnvironment_ReactorEnv(t *testing.T) {
	t.Setenv("REACTOR_ENV", "production")
	t.Setenv("APP_ENV", "staging")

	env := detectEnvironment()
	if env != "production" {
		t.Errorf("detectEnvironment() = %q, want %q", env, "production")
	}
}

func TestDetectEnvironment_AppEnvFallback(t *testing.T) {
	t.Setenv("REACTOR_ENV", "")
	t.Setenv("APP_ENV", "test")

	env := detectEnvironment()
	if env != "test" {
		t.Errorf("detectEnvironment() = %q, want %q", env, "test")
	}
}

func TestDetectEnvironment_Default(t *testing.T) {
	t.Setenv("REACTOR_ENV", "")
	t.Setenv("APP_ENV", "")

	env := detectEnvironment()
	if env != "development" {
		t.Errorf("detectEnvironment() = %q, want %q", env, "development")
	}
}

func TestAuthTokenEnvVar(t *testing.T) {
	// Set up YAML config dir, then set the secret env var before loading.
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "config")
	if err := os.MkdirAll(configDir, 0o750); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	yamlContent := "flink:\n  rest_url: \"http://flink:8081\"\n"
	if err := os.WriteFile(filepath.Join(configDir, "development.yml"), []byte(yamlContent), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })

	t.Setenv("REACTOR_ENV", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("FLINK_AUTH_TOKEN", "my-secret-token")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Flink.AuthToken != "my-secret-token" {
		t.Errorf("Flink.AuthToken = %q, want %q", cfg.Flink.AuthToken, "my-secret-token")
	}
}

func TestInitSQLPathEnvVar(t *testing.T) {
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })

	t.Setenv("REACTOR_ENV", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("FLINK_AUTH_TOKEN", "")
	t.Setenv("FLINK_INIT_SQL_PATH", "/opt/flink/init/init-catalogs.sql")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Flink.InitSQLPath != "/opt/flink/init/init-catalogs.sql" {
		t.Errorf("Flink.InitSQLPath = %q, want %q", cfg.Flink.InitSQLPath, "/opt/flink/init/init-catalogs.sql")
	}
}

func TestYAMLConfigValues(t *testing.T) {
	cfg := loadWithYAML(t, `
flink:
  rest_url: "http://flink:8081"
  sql_gateway_url: "http://sqlgw:8083"
  init_sql_path: "/opt/flink/init/init-catalogs.sql"

server:
  port: 9090

health:
  interval: "45s"

log:
  level: "debug"

spa:
  static_dir: "/app/dist"
`)

	if cfg.Flink.RestURL != "http://flink:8081" {
		t.Errorf("Flink.RestURL = %q, want %q", cfg.Flink.RestURL, "http://flink:8081")
	}
	if cfg.Flink.SQLGatewayURL != "http://sqlgw:8083" {
		t.Errorf("Flink.SQLGatewayURL = %q, want %q", cfg.Flink.SQLGatewayURL, "http://sqlgw:8083")
	}
	if cfg.Flink.InitSQLPath != "/opt/flink/init/init-catalogs.sql" {
		t.Errorf("Flink.InitSQLPath = %q, want %q", cfg.Flink.InitSQLPath, "/opt/flink/init/init-catalogs.sql")
	}
	if cfg.Server.Port != 9090 {
		t.Errorf("Server.Port = %d, want 9090", cfg.Server.Port)
	}
	if cfg.Health.Interval != 45*time.Second {
		t.Errorf("Health.Interval = %v, want %v", cfg.Health.Interval, 45*time.Second)
	}
	if cfg.Log.Level != "debug" {
		t.Errorf("Log.Level = %q, want %q", cfg.Log.Level, "debug")
	}
	if cfg.SPA.StaticDir != "/app/dist" {
		t.Errorf("SPA.StaticDir = %q, want %q", cfg.SPA.StaticDir, "/app/dist")
	}

	// Single cluster from flink.* settings.
	if len(cfg.Clusters) != 1 {
		t.Fatalf("len(Clusters) = %d, want 1", len(cfg.Clusters))
	}
	if cfg.Clusters[0].URL != "http://flink:8081" {
		t.Errorf("Clusters[0].URL = %q, want %q", cfg.Clusters[0].URL, "http://flink:8081")
	}
	if cfg.Clusters[0].SQLGatewayURL != "http://sqlgw:8083" {
		t.Errorf("Clusters[0].SQLGatewayURL = %q, want %q", cfg.Clusters[0].SQLGatewayURL, "http://sqlgw:8083")
	}
}

func TestYAMLMultiCluster(t *testing.T) {
	cfg := loadWithYAML(t, `
clusters:
  - name: "production"
    url: "http://flink-prod:8081"
    sql_gateway_url: "http://sqlgw-prod:8083"
    default: true
  - name: "staging"
    url: "http://flink-staging:8081"
`)

	if len(cfg.Clusters) != 2 {
		t.Fatalf("len(Clusters) = %d, want 2", len(cfg.Clusters))
	}

	prod := cfg.Clusters[0]
	if prod.Name != "production" {
		t.Errorf("Clusters[0].Name = %q, want %q", prod.Name, "production")
	}
	if prod.URL != "http://flink-prod:8081" {
		t.Errorf("Clusters[0].URL = %q, want %q", prod.URL, "http://flink-prod:8081")
	}
	if prod.SQLGatewayURL != "http://sqlgw-prod:8083" {
		t.Errorf("Clusters[0].SQLGatewayURL = %q, want %q", prod.SQLGatewayURL, "http://sqlgw-prod:8083")
	}
	if !prod.Default {
		t.Error("Clusters[0].Default = false, want true")
	}

	staging := cfg.Clusters[1]
	if staging.Name != "staging" {
		t.Errorf("Clusters[1].Name = %q, want %q", staging.Name, "staging")
	}
	if staging.URL != "http://flink-staging:8081" {
		t.Errorf("Clusters[1].URL = %q, want %q", staging.URL, "http://flink-staging:8081")
	}
}

func TestYAMLInstruments(t *testing.T) {
	cfg := loadWithYAML(t, `
flink:
  rest_url: "http://localhost:8081"

instruments:
  - type: "kafka"
    name: "local-kafka"
    config:
      brokers: "localhost:9092"
  - type: "database"
    name: "local-pg"
    config:
      driver: "postgres"
      dsn: "postgres://localhost:5433/mydb"
`)

	if len(cfg.Instruments) != 2 {
		t.Fatalf("len(Instruments) = %d, want 2", len(cfg.Instruments))
	}
	if cfg.Instruments[0].Type != "kafka" {
		t.Errorf("Instruments[0].Type = %q, want %q", cfg.Instruments[0].Type, "kafka")
	}
	if cfg.Instruments[0].Name != "local-kafka" {
		t.Errorf("Instruments[0].Name = %q, want %q", cfg.Instruments[0].Name, "local-kafka")
	}
	if cfg.Instruments[1].Type != "database" {
		t.Errorf("Instruments[1].Type = %q, want %q", cfg.Instruments[1].Type, "database")
	}
}

func TestDurationFromYAML(t *testing.T) {
	cfg := loadWithYAML(t, `
flink:
  rest_url: "http://localhost:8081"

health:
  interval: "2m"
`)

	if cfg.Health.Interval != 2*time.Minute {
		t.Errorf("Health.Interval = %v, want %v", cfg.Health.Interval, 2*time.Minute)
	}
}

func TestHelperMethods(t *testing.T) {
	tests := []struct {
		env           string
		isDev, isProd bool
		isTest        bool
	}{
		{"development", true, false, false},
		{"production", false, true, false},
		{"test", false, false, true},
		{"staging", false, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.env, func(t *testing.T) {
			cfg := &Config{App: AppConfig{Environment: tt.env}}
			if got := cfg.IsDevelopment(); got != tt.isDev {
				t.Errorf("IsDevelopment() = %v, want %v", got, tt.isDev)
			}
			if got := cfg.IsProduction(); got != tt.isProd {
				t.Errorf("IsProduction() = %v, want %v", got, tt.isProd)
			}
			if got := cfg.IsTest(); got != tt.isTest {
				t.Errorf("IsTest() = %v, want %v", got, tt.isTest)
			}
		})
	}
}

func TestAddress(t *testing.T) {
	cfg := &Config{Server: ServerConfig{Host: "0.0.0.0", Port: 8080}}
	if got := cfg.Address(); got != "0.0.0.0:8080" {
		t.Errorf("Address() = %q, want %q", got, "0.0.0.0:8080")
	}

	cfg.Server.Host = "127.0.0.1"
	cfg.Server.Port = 9090
	if got := cfg.Address(); got != "127.0.0.1:9090" {
		t.Errorf("Address() = %q, want %q", got, "127.0.0.1:9090")
	}
}

func TestLogLevel(t *testing.T) {
	tests := []struct {
		level string
		want  slog.Level
	}{
		{"debug", slog.LevelDebug},
		{"info", slog.LevelInfo},
		{"warn", slog.LevelWarn},
		{"error", slog.LevelError},
		{"unknown", slog.LevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.level, func(t *testing.T) {
			cfg := &Config{Log: LogConfig{Level: tt.level}}
			if got := cfg.LogLevel(); got != tt.want {
				t.Errorf("LogLevel() = %v, want %v", got, tt.want)
			}
		})
	}
}
