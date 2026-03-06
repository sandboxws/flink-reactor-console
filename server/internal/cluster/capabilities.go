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
// Accepts formats like "2.0", "2.0.0", "1.20.1".
func parseVersion(version string) (major, minor int, ok bool) {
	parts := strings.SplitN(version, ".", 3)
	if len(parts) < 2 {
		return 0, 0, false
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, false
	}

	minor, err = strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, false
	}

	return major, minor, true
}
