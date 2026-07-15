// Package manifests ingests versioned pipeline State Manifests pushed by the
// DSL (state-collision-01) and persists them via the PipelineManifestStore.
// The canonical manifest types live in the compatibility package (the leaf
// that also compares them), so ingest and comparison share one contract.
package manifests

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/sandboxws/flink-reactor-console/server/internal/compatibility"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
	"github.com/sandboxws/flink-reactor-console/server/internal/store"
)

// DefaultEnvironment is used when a manifest is pushed without an environment.
const DefaultEnvironment = "default"

// Store ingests State Manifests into the versioned registry.
type Store struct {
	manifests *store.PipelineManifestStore
}

// NewStore creates a manifests Store backed by the given PipelineManifestStore.
func NewStore(manifests *store.PipelineManifestStore) *Store {
	return &Store{manifests: manifests}
}

// Ingest stores a manifest as a new version for (pipelineName, environment),
// returning the inserted row (with its assigned version).
func (s *Store) Ingest(
	ctx context.Context,
	sm compatibility.StateManifest,
	environment string,
) (storage.DBPipelineManifest, error) {
	if environment == "" {
		environment = DefaultEnvironment
	}

	manifestJSON, err := json.Marshal(sm)
	if err != nil {
		return storage.DBPipelineManifest{}, fmt.Errorf("marshal manifest: %w", err)
	}
	operatorsJSON, err := json.Marshal(sm.Operators)
	if err != nil {
		return storage.DBPipelineManifest{}, fmt.Errorf("marshal operators: %w", err)
	}

	var flinkVersion *string
	if sm.FlinkVersion != "" {
		flinkVersion = &sm.FlinkVersion
	}

	return s.manifests.Insert(ctx, storage.DBPipelineManifest{
		PipelineName:     sm.PipelineName,
		Environment:      environment,
		FlinkVersion:     flinkVersion,
		Manifest:         manifestJSON,
		StateFingerprint: sm.Fingerprint,
		OperatorStates:   operatorsJSON,
		Source:           "cli",
	})
}

// StateManifestFromRow decodes a stored row back into a StateManifest, used by
// the GraphQL resolvers to drive compatibility.Compare. A nil row yields the
// zero manifest.
func StateManifestFromRow(row *storage.DBPipelineManifest) (compatibility.StateManifest, error) {
	if row == nil {
		return compatibility.StateManifest{}, nil
	}
	var sm compatibility.StateManifest
	if err := json.Unmarshal(row.Manifest, &sm); err != nil {
		return compatibility.StateManifest{}, fmt.Errorf(
			"unmarshal manifest %q v%d: %w", row.PipelineName, row.Version, err,
		)
	}
	return sm, nil
}
