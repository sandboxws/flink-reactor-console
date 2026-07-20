// Package instruments provides the plugin system for infrastructure instruments.
package instruments

import (
	"context"
	"encoding/json"
	"time"
)

// Capability represents a feature an instrument supports.
type Capability string

// Capability constants for instrument features.
const (
	CapabilityBrowse    Capability = "browse"
	CapabilitySample    Capability = "sample"
	CapabilityMetrics   Capability = "metrics"
	CapabilityHighlight Capability = "highlight"
	CapabilitySeed      Capability = "seed"
)

// ResourceRef identifies an infrastructure resource referenced by a pipeline.
type ResourceRef struct {
	Name             string `json:"name"`
	Role             string `json:"role"` // "source" or "sink"
	PipelineRelevant bool   `json:"pipelineRelevant"`
}

// InstrumentInfo is returned by the instruments GraphQL query.
type InstrumentInfo struct {
	Name            string     `json:"name"`
	DisplayName     string     `json:"displayName"`
	Type            string     `json:"type"`
	Version         string     `json:"version"`
	Healthy         bool       `json:"healthy"`
	LastHealthCheck *time.Time `json:"lastHealthCheck"`
	Capabilities    []string   `json:"capabilities"`
}

// Instrument is the interface that infrastructure plugins implement.
type Instrument interface {
	// Name returns a unique kebab-case identifier.
	Name() string
	// DisplayName returns a human-readable name.
	DisplayName() string
	// Version returns a semver version string.
	Version() string
	// Type returns the instrument type (e.g., "kafka", "database").
	Type() string
	// Init initializes the instrument with JSON configuration.
	Init(ctx context.Context, cfg json.RawMessage) error
	// Shutdown releases resources.
	Shutdown(ctx context.Context) error
	// HealthCheck verifies connectivity.
	HealthCheck(ctx context.Context) error
	// Capabilities returns what the instrument can do.
	Capabilities() []Capability
	// HighlightResources finds resources referenced in pipeline SQL.
	HighlightResources(ctx context.Context, pipelineSQL string) ([]ResourceRef, error)
}
