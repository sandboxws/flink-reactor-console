// Package config provides centralized configuration loading for the reactor-server.
// It uses Viper to load settings from environment-specific YAML files, env var
// overrides (REACTOR_ prefix), and legacy env var bindings for backward compatibility.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/go-viper/mapstructure/v2"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
	"github.com/spf13/viper"
)

// Config is the top-level configuration for the reactor-server.
type Config struct {
	App         AppConfig                      `mapstructure:"app"`
	Server      ServerConfig                   `mapstructure:"server"`
	Clusters    []cluster.Config               `mapstructure:"clusters"`
	Flink       FlinkConfig                    `mapstructure:"flink"`
	SQLGateway  SQLGatewayConfig               `mapstructure:"sql_gateway"`
	Health      HealthConfig                   `mapstructure:"health"`
	Instruments []instruments.InstrumentConfig `mapstructure:"instruments"`
	Log         LogConfig                      `mapstructure:"log"`
	SPA         SPAConfig                      `mapstructure:"spa"`
}

// AppConfig holds application-level settings.
type AppConfig struct {
	Name        string `mapstructure:"name"`
	Environment string `mapstructure:"environment"`
	Debug       bool   `mapstructure:"debug"`
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	DrainTimeout time.Duration `mapstructure:"drain_timeout"`
}

// FlinkConfig holds default Flink REST connection settings.
type FlinkConfig struct {
	RestURL   string `mapstructure:"rest_url"`
	AuthToken string `mapstructure:"auth_token"`
}

// SQLGatewayConfig holds SQL Gateway settings.
type SQLGatewayConfig struct {
	URL string `mapstructure:"url"`
}

// HealthConfig holds health check settings.
type HealthConfig struct {
	Interval time.Duration `mapstructure:"interval"`
}

// LogConfig holds logging settings.
type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

// SPAConfig holds SPA static file serving settings.
type SPAConfig struct {
	StaticDir string `mapstructure:"static_dir"`
}

// IsDevelopment returns true when the environment is "development".
func (c *Config) IsDevelopment() bool {
	return c.App.Environment == "development"
}

// IsProduction returns true when the environment is "production".
func (c *Config) IsProduction() bool {
	return c.App.Environment == "production"
}

// IsTest returns true when the environment is "test".
func (c *Config) IsTest() bool {
	return c.App.Environment == "test"
}

// Address returns the server bind address in "host:port" format.
func (c *Config) Address() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}

// LogLevel returns the slog.Level corresponding to the configured log level string.
func (c *Config) LogLevel() slog.Level {
	switch c.Log.Level {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// Load reads configuration from environment-specific YAML files and env var
// overrides. Priority (highest to lowest): env vars > YAML file > defaults.
func Load() (*Config, error) {
	v := viper.New()

	setDefaults(v)

	// Detect environment: REACTOR_ENV > APP_ENV > "development".
	env := detectEnvironment()

	// Set the config file name to the detected environment.
	v.SetConfigName(env)
	v.SetConfigType("yaml")
	v.AddConfigPath("./config/")
	v.AddConfigPath("../config/")
	v.AddConfigPath("../../config/")
	v.AddConfigPath("/etc/reactor-server/")

	// Read config file — missing file is not an error.
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config file: %w", err)
		}
	}

	// Enable automatic env var binding with REACTOR_ prefix.
	// Replace dots with underscores so "server.port" maps to REACTOR_SERVER_PORT.
	v.SetEnvPrefix("REACTOR")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Bind legacy env vars for backward compatibility.
	bindLegacyEnvVars(v)

	// Override environment from detection (not from YAML/env binding).
	v.Set("app.environment", env)

	cfg := &Config{}
	if err := v.Unmarshal(cfg, viper.DecodeHook(
		mapstructure.ComposeDecodeHookFunc(
			mapstructure.StringToTimeDurationHookFunc(),
			durationDecodeHook(),
		),
	)); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	// Load clusters: env var JSON takes precedence over YAML.
	if err := loadClusters(v, cfg); err != nil {
		return nil, fmt.Errorf("loading clusters: %w", err)
	}

	// Load instruments: env var JSON takes precedence over YAML.
	loadInstruments(cfg)

	return cfg, nil
}

// setDefaults registers hardcoded default values.
func setDefaults(v *viper.Viper) {
	v.SetDefault("app.name", "reactor-server")
	v.SetDefault("app.environment", "development")
	v.SetDefault("app.debug", false)

	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.read_timeout", "30s")
	v.SetDefault("server.write_timeout", "30s")
	v.SetDefault("server.drain_timeout", "30s")

	v.SetDefault("flink.rest_url", "http://localhost:8081")
	v.SetDefault("flink.auth_token", "")

	v.SetDefault("sql_gateway.url", "")

	v.SetDefault("health.interval", "30s")

	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "console")

	v.SetDefault("spa.static_dir", "")
}

// detectEnvironment returns the environment name from REACTOR_ENV, APP_ENV, or "development".
func detectEnvironment() string {
	if env := os.Getenv("REACTOR_ENV"); env != "" {
		return env
	}
	if env := os.Getenv("APP_ENV"); env != "" {
		return env
	}
	return "development"
}

// bindLegacyEnvVars binds existing env vars to their config paths so deployments
// using the old env var names continue to work.
func bindLegacyEnvVars(v *viper.Viper) {
	_ = v.BindEnv("flink.rest_url", "FLINK_REST_URL")         // legacy: FLINK_REST_URL
	_ = v.BindEnv("flink.auth_token", "FLINK_AUTH_TOKEN")     // legacy: FLINK_AUTH_TOKEN
	_ = v.BindEnv("sql_gateway.url", "SQL_GATEWAY_URL")       // legacy: SQL_GATEWAY_URL
	_ = v.BindEnv("health.interval", "HEALTH_CHECK_INTERVAL") // legacy: HEALTH_CHECK_INTERVAL
	_ = v.BindEnv("spa.static_dir", "STATIC_DIR")             // legacy: STATIC_DIR
}

// loadClusters handles cluster config from the CLUSTERS env var (JSON) or falls
// back to constructing a single-cluster config from flink.* settings.
func loadClusters(v *viper.Viper, cfg *Config) error {
	if clustersJSON := os.Getenv("CLUSTERS"); clustersJSON != "" {
		configs, err := cluster.ParseClustersEnv(clustersJSON, "", "", "")
		if err != nil {
			return err
		}
		cfg.Clusters = configs
		return nil
	}

	// If no CLUSTERS env var and no clusters in YAML, build a single-cluster
	// config from the flink.* settings.
	if len(cfg.Clusters) == 0 {
		configs, err := cluster.ParseClustersEnv(
			"",
			v.GetString("flink.rest_url"),
			v.GetString("flink.auth_token"),
			v.GetString("sql_gateway.url"),
		)
		if err != nil {
			return err
		}
		cfg.Clusters = configs
	}

	return nil
}

// loadInstruments handles instrument config from the INSTRUMENTS env var (JSON).
// If the env var is set, it overrides any YAML-defined instruments.
func loadInstruments(cfg *Config) {
	if instJSON := os.Getenv("INSTRUMENTS"); instJSON != "" {
		configs, err := instruments.ParseInstrumentsEnv(instJSON)
		if err != nil {
			// Log warning but don't fail — instruments are optional.
			slog.Warn("invalid INSTRUMENTS env var, ignoring", "error", err)
			cfg.Instruments = nil
			return
		}
		cfg.Instruments = configs
	}
}

// durationDecodeHook returns a mapstructure decode hook that converts numeric
// values (seconds) to time.Duration. Viper's StringToTimeDurationHookFunc handles
// string values; this hook handles the case where YAML parses a bare number.
func durationDecodeHook() mapstructure.DecodeHookFunc {
	return func(_ reflect.Type, to reflect.Type, data interface{}) (interface{}, error) {
		if to != reflect.TypeOf(time.Duration(0)) {
			return data, nil
		}

		switch v := data.(type) {
		case int64:
			return time.Duration(v) * time.Second, nil
		case float64:
			return time.Duration(v * float64(time.Second)), nil
		}

		return data, nil
	}
}
