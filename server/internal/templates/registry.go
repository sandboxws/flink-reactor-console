// Package templates provides the embedded template registry. The manifest is
// projected from the flink-reactor-dsl scaffolder registry (its
// `templateManifest()`) and vendored here via scripts/refresh-templates.sh —
// run that script to regenerate templates.generated.json when the DSL registry
// (TEMPLATE_FACTORIES) changes.
package templates

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

//go:embed templates.generated.json
var raw []byte

// Param is one scaffold-form input for a template.
type Param struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Required    bool     `json:"required"`
	Default     *string  `json:"default,omitempty"`
	Options     []string `json:"options,omitempty"`
	Description *string  `json:"description,omitempty"`
}

// Manifest is the projected, serialisable shape of one registered template.
type Manifest struct {
	Name             string   `json:"name"`
	Category         string   `json:"category"`
	Description      string   `json:"description"`
	Pipelines        []string `json:"pipelines"`
	RequiredServices []string `json:"requiredServices"`
	Params           []Param  `json:"params"`
}

// File is one materialised file from instantiating a template.
type File struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// Source is a template's scaffolded output, for the no-Node instantiation path.
type Source struct {
	Files       []File `json:"files"`
	PipelineTsx string `json:"pipelineTsx"`
}

// artifact is the on-disk `templates.generated.json` payload. `Count`/`Names`
// are a build stamp the loader checks the `Manifest` slice against for drift.
type artifact struct {
	Version  int               `json:"version"`
	Count    int               `json:"count"`
	Names    []string          `json:"names"`
	Manifest []Manifest        `json:"manifest"`
	Sources  map[string]Source `json:"sources"`
}

// Registry is the parsed, embedded template registry.
type Registry struct {
	Version  int
	Manifest []Manifest
	sources  map[string]Source
	byName   map[string]Manifest

	// Drift is set when the embedded manifest diverges from the build stamp it
	// was generated with (a corrupted, truncated, or hand-edited vendored file).
	// It mirrors the G1 "drift is a hard failure" contract on the server side.
	Drift    bool
	DriftMsg string
}

// Load parses the embedded template manifest and checks it for drift.
func Load() (*Registry, error) {
	var a artifact
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, fmt.Errorf("parsing embedded template manifest: %w", err)
	}

	reg := &Registry{
		Version:  a.Version,
		Manifest: a.Manifest,
		sources:  a.Sources,
		byName:   make(map[string]Manifest, len(a.Manifest)),
	}
	for _, m := range a.Manifest {
		reg.byName[m.Name] = m
	}
	reg.Drift, reg.DriftMsg = detectDrift(&a)

	return reg, nil
}

// detectDrift compares the build-stamp count/names to the actual manifest
// payload. Divergence means the embedded artifact is not internally consistent.
func detectDrift(a *artifact) (bool, string) {
	if a.Count != len(a.Manifest) {
		return true, fmt.Sprintf(
			"stamp count %d != manifest entries %d", a.Count, len(a.Manifest),
		)
	}

	stamp := append([]string(nil), a.Names...)
	got := make([]string, 0, len(a.Manifest))
	for _, m := range a.Manifest {
		got = append(got, m.Name)
	}
	sort.Strings(stamp)
	sort.Strings(got)

	if len(stamp) != len(got) {
		return true, fmt.Sprintf(
			"stamp names %d != manifest names %d", len(stamp), len(got),
		)
	}
	for i := range stamp {
		if stamp[i] != got[i] {
			return true, fmt.Sprintf(
				"stamp names diverge from manifest (%q vs %q)", stamp[i], got[i],
			)
		}
	}

	return false, ""
}

// All returns every template in registry order.
func (r *Registry) All() []Manifest { return r.Manifest }

// ByCategory returns the templates in a category (case-insensitive). An empty
// category returns every template.
func (r *Registry) ByCategory(category string) []Manifest {
	if category == "" {
		return r.Manifest
	}
	out := make([]Manifest, 0, len(r.Manifest))
	for _, m := range r.Manifest {
		if strings.EqualFold(m.Category, category) {
			out = append(out, m)
		}
	}
	return out
}

// Get returns a template by name.
func (r *Registry) Get(name string) (Manifest, bool) {
	m, ok := r.byName[name]
	return m, ok
}

// Source returns a template's scaffolded files for instantiation.
func (r *Registry) Source(name string) (Source, bool) {
	s, ok := r.sources[name]
	return s, ok
}
