package cluster

import (
	"strconv"
	"strings"
)

type gatedCapability struct {
	Name     string
	MinMajor int
	MinMinor int
}

var gatedCapabilities = []gatedCapability{
	{Name: "QUALIFY", MinMajor: 2, MinMinor: 0},
	{Name: "MATERIALIZED_TABLE", MinMajor: 2, MinMinor: 0},
	{Name: "CREATE_MODEL", MinMajor: 2, MinMinor: 1},
	{Name: "VECTOR_SEARCH", MinMajor: 2, MinMinor: 2},
	{Name: "MATERIALIZED_TABLE_BUCKETING", MinMajor: 2, MinMinor: 2},
	// Flink 2.3
	{Name: "MATERIALIZED_TABLE_SCHEMA", MinMajor: 2, MinMinor: 3},
	{Name: "MATERIALIZED_TABLE_START_MODE", MinMajor: 2, MinMinor: 3},
	{Name: "MATERIALIZED_TABLE_EVOLUTION", MinMajor: 2, MinMinor: 3},
	{Name: "UPSERT_ON_CONFLICT", MinMajor: 2, MinMinor: 3},
	{Name: "FROM_TO_CHANGELOG", MinMajor: 2, MinMinor: 3},
	{Name: "RESCALE_HISTORY", MinMajor: 2, MinMinor: 3},
	// ADAPTIVE_PARTITIONING (taskmanager.network.adaptive-partitioner.*) is a
	// TaskManager network-layer config with no per-job/vertex REST surface, so
	// it stays a reserved flag — it is only observable via cluster config, not
	// per-job telemetry. Do not build a backpressure/vertex UI against it.
	{Name: "ADAPTIVE_PARTITIONING", MinMajor: 2, MinMinor: 3},
	{Name: "APPLICATION_MODE", MinMajor: 2, MinMinor: 3},
}

// asyncProfilerMinMajor / asyncProfilerMinMinor gate ASYNC_PROFILER on the
// Flink release that added the built-in async profiler (FLIP-375, Flink 1.19).
const (
	asyncProfilerMinMajor = 1
	asyncProfilerMinMinor = 19
)

// CapabilitiesForVersionAndConfig returns CapabilitiesForVersion plus any
// capability that additionally depends on cluster configuration. Today that is
// only ASYNC_PROFILER, which requires both Flink >= 1.19 and
// `rest.profiling.enabled` (profilingEnabled). Keeping it separate from the
// pure version gates lets the resolver feed in the config signal without every
// capability having to know about config.
func CapabilitiesForVersionAndConfig(version string, profilingEnabled bool) []string {
	caps := CapabilitiesForVersion(version)
	if profilingEnabled && supportsAsyncProfiler(version) {
		caps = append(caps, "ASYNC_PROFILER")
	}
	return caps
}

// supportsAsyncProfiler reports whether the version is >= 1.19, the release
// that introduced the built-in profiler.
func supportsAsyncProfiler(version string) bool {
	major, minor, ok := parseVersion(version)
	if !ok {
		return false
	}
	return major > asyncProfilerMinMajor ||
		(major == asyncProfilerMinMajor && minor >= asyncProfilerMinMinor)
}

// CapabilitiesForVersion returns the list of SQL feature strings available
// for the given Flink version string (e.g. "2.0.0", "1.20.1", "2.2").
func CapabilitiesForVersion(version string) []string {
	major, minor, ok := parseVersion(version)
	if !ok {
		return []string{}
	}

	var caps []string
	for _, cap := range gatedCapabilities {
		if major > cap.MinMajor || (major == cap.MinMajor && minor >= cap.MinMinor) {
			caps = append(caps, cap.Name)
		}
	}
	return caps
}

// parseVersion extracts major and minor version numbers from a version string.
// Accepts formats like "2.0", "2.0.0", "1.20.1", and pre-release/dev strings
// like "2.3-SNAPSHOT" or "2.3.0-rc1" that Flink RC and nightly builds report.
func parseVersion(version string) (major, minor int, ok bool) {
	parts := strings.SplitN(version, ".", 3)
	if len(parts) < 2 {
		return 0, 0, false
	}

	major, err := strconv.Atoi(trimVersionSuffix(parts[0]))
	if err != nil {
		return 0, 0, false
	}

	minor, err = strconv.Atoi(trimVersionSuffix(parts[1]))
	if err != nil {
		return 0, 0, false
	}

	return major, minor, true
}

// trimVersionSuffix returns the leading run of digits in s, dropping any
// pre-release or build suffix. This keeps a 2-part version like "2.3-SNAPSHOT"
// (which splits into "2" and "3-SNAPSHOT") from failing the integer parse and
// silently hiding every 2.3 feature on RC/dev clusters.
func trimVersionSuffix(s string) string {
	for i, r := range s {
		if r < '0' || r > '9' {
			return s[:i]
		}
	}
	return s
}
