package config

import "strings"

// envAllowsSeeding reports whether an environment name permits Kafka seeding.
//
// The policy is deliberately asymmetric:
//   - development is always permitted (the local inner loop depends on it);
//   - production is never permitted — a hard block no flag can lift;
//   - every other environment (staging, test, unknown) is permitted only when
//     the operator opts in via seeding.enabled.
func envAllowsSeeding(env string, stagingEnabled bool) bool {
	switch env {
	case "development":
		return true
	case "production":
		return false
	default:
		return stagingEnabled
	}
}

// SeedingAllowed applies the defense-in-depth guard: seeding a Kafka instrument
// is permitted only when BOTH the server's deployment environment AND the
// instrument's own environment permit it. Because production returns false
// unconditionally, a production server OR a production-tagged instrument is an
// absolute block — a development console can never seed a Kafka tagged
// production, and a production console can never seed anything.
func SeedingAllowed(serverEnv, instrumentEnv string, stagingEnabled bool) bool {
	if instrumentEnv == "" {
		instrumentEnv = serverEnv
	}
	return envAllowsSeeding(serverEnv, stagingEnabled) &&
		envAllowsSeeding(instrumentEnv, stagingEnabled)
}

// InferInstrumentEnv resolves the environment an instrument connects to. An
// explicit tag always wins. Otherwise the instrument name is matched the same
// way the dashboard's clusterEnv() infers environment from a cluster name, so a
// Kafka named "...prod..." is treated as production even without a tag; an
// unmatched name falls back to the server's own environment.
func InferInstrumentEnv(name, explicit, serverEnv string) string {
	if explicit != "" {
		return explicit
	}
	switch lower := strings.ToLower(name); {
	case strings.Contains(lower, "prod"):
		return "production"
	case strings.Contains(lower, "stag"), strings.Contains(lower, "preview"):
		return "staging"
	default:
		return serverEnv
	}
}
