package config

import (
	"log/slog"
	"os"
	"testing"
	"time"
)

// loadClean calls Load() from a temp directory with no config files,
// ensuring only defaults and env vars take effect.
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

	// Clear all env vars that could interfere.
	for _, key := range []string{
		"REACTOR_ENV", "APP_ENV", "CLUSTERS", "INSTRUMENTS",
		"FLINK_REST_URL", "FLINK_AUTH_TOKEN", "SQL_GATEWAY_URL",
		"HEALTH_CHECK_INTERVAL", "STATIC_DIR",
		"REACTOR_SERVER_PORT", "REACTOR_LOG_LEVEL",
		"REACTOR_HEALTH_INTERVAL", "REACTOR_FLINK_REST_URL",
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

func TestEnvVarOverrides(t *testing.T) {
	// Start from a clean state (temp dir, no YAML).
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })

	for _, key := range []string{
		"REACTOR_ENV", "APP_ENV", "CLUSTERS", "INSTRUMENTS",
		"FLINK_REST_URL", "FLINK_AUTH_TOKEN", "SQL_GATEWAY_URL",
		"HEALTH_CHECK_INTERVAL", "STATIC_DIR",
	} {
		t.Setenv(key, "")
	}

	t.Setenv("REACTOR_SERVER_PORT", "9090")
	t.Setenv("REACTOR_LOG_LEVEL", "debug")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Server.Port != 9090 {
		t.Errorf("Server.Port = %d, want 9090", cfg.Server.Port)
	}
	if cfg.Log.Level != "debug" {
		t.Errorf("Log.Level = %q, want %q", cfg.Log.Level, "debug")
	}
}

func TestLegacyEnvVarBindings(t *testing.T) {
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })

	for _, key := range []string{"REACTOR_ENV", "APP_ENV", "CLUSTERS", "INSTRUMENTS"} {
		t.Setenv(key, "")
	}

	t.Setenv("FLINK_REST_URL", "http://flink:8081")
	t.Setenv("FLINK_AUTH_TOKEN", "my-token")
	t.Setenv("SQL_GATEWAY_URL", "http://sqlgw:8083")
	t.Setenv("HEALTH_CHECK_INTERVAL", "45s")
	t.Setenv("STATIC_DIR", "/app/dist")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Flink.RestURL != "http://flink:8081" {
		t.Errorf("Flink.RestURL = %q, want %q", cfg.Flink.RestURL, "http://flink:8081")
	}
	if cfg.Flink.AuthToken != "my-token" {
		t.Errorf("Flink.AuthToken = %q, want %q", cfg.Flink.AuthToken, "my-token")
	}
	if cfg.SQLGateway.URL != "http://sqlgw:8083" {
		t.Errorf("SQLGateway.URL = %q, want %q", cfg.SQLGateway.URL, "http://sqlgw:8083")
	}
	if cfg.Health.Interval != 45*time.Second {
		t.Errorf("Health.Interval = %v, want %v", cfg.Health.Interval, 45*time.Second)
	}
	if cfg.SPA.StaticDir != "/app/dist" {
		t.Errorf("SPA.StaticDir = %q, want %q", cfg.SPA.StaticDir, "/app/dist")
	}

	// Clusters should use the legacy FLINK_REST_URL.
	if len(cfg.Clusters) != 1 {
		t.Fatalf("len(Clusters) = %d, want 1", len(cfg.Clusters))
	}
	if cfg.Clusters[0].URL != "http://flink:8081" {
		t.Errorf("Clusters[0].URL = %q, want %q", cfg.Clusters[0].URL, "http://flink:8081")
	}
}

func TestDurationFromEnvVar(t *testing.T) {
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	tmpDir := t.TempDir()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })

	for _, key := range []string{"REACTOR_ENV", "APP_ENV", "CLUSTERS", "INSTRUMENTS", "FLINK_REST_URL"} {
		t.Setenv(key, "")
	}

	t.Setenv("REACTOR_HEALTH_INTERVAL", "2m")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

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
