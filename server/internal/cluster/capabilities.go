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
	{Name: "ADAPTIVE_PARTITIONING", MinMajor: 2, MinMinor: 3},
	{Name: "APPLICATION_MODE", MinMajor: 2, MinMinor: 3},
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
