// Package seed provides the embedded Kafka seed-data catalog. The catalog is
// exported from flink-reactor-dsl (its SEED_SUBJECTS table) and vendored here
// via scripts/refresh-seeds.sh — run that script to regenerate seeds.json when
// the DSL fixtures change.
package seed

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

//go:embed seeds.json
var raw []byte

// Catalog is the parsed seed-data catalog.
type Catalog struct {
	Version  int       `json:"version"`
	Subjects []Subject `json:"subjects"`
}

// Subject is one Kafka topic's seed schema and sample rows. JSONSchema and each
// SampleRows element are kept as raw JSON so the producer emits the exact bytes
// the DSL exported.
type Subject struct {
	Topic      string            `json:"topic"`
	Subject    string            `json:"subject"`
	Domain     string            `json:"domain"`
	JSONSchema json.RawMessage   `json:"jsonSchema"`
	SampleRows []json.RawMessage `json:"sampleRows"`
}

// Load parses the embedded seed catalog.
func Load() (*Catalog, error) {
	var c Catalog
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, fmt.Errorf("parsing embedded seed catalog: %w", err)
	}
	return &c, nil
}

// ByDomain returns the subjects for a domain. An empty string or "all" returns
// every subject. Matching is case-insensitive.
func (c *Catalog) ByDomain(domain string) []Subject {
	if domain == "" || strings.EqualFold(domain, "all") {
		return c.Subjects
	}
	var out []Subject
	for _, s := range c.Subjects {
		if strings.EqualFold(s.Domain, domain) {
			out = append(out, s)
		}
	}
	return out
}

// ByTopics returns the subjects whose topic appears in names. Used to scope
// seeding to a project's own topics — those already present in the broker
// after `cluster up` — rather than the whole demo catalog. Matching is exact.
func (c *Catalog) ByTopics(names []string) []Subject {
	want := make(map[string]struct{}, len(names))
	for _, n := range names {
		want[n] = struct{}{}
	}
	var out []Subject
	for _, s := range c.Subjects {
		if _, ok := want[s.Topic]; ok {
			out = append(out, s)
		}
	}
	return out
}

// Domains returns the sorted, unique domain names present in the catalog.
func (c *Catalog) Domains() []string {
	seen := make(map[string]struct{}, len(c.Subjects))
	out := make([]string, 0, len(c.Subjects))
	for _, s := range c.Subjects {
		if _, ok := seen[s.Domain]; ok {
			continue
		}
		seen[s.Domain] = struct{}{}
		out = append(out, s.Domain)
	}
	sort.Strings(out)
	return out
}
