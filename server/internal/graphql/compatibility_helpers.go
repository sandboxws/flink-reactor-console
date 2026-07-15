package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/sandboxws/flink-reactor-console/server/internal/compatibility"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor-console/server/internal/manifests"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
	"github.com/sandboxws/flink-reactor-console/server/internal/store"
)

// Hand-written helpers backing compatibility.resolvers.go. Kept here (not in
// the resolver file) so gqlgen — which owns *.resolvers.go — leaves them alone.

func environmentOrDefault(env *string) string {
	if env == nil || *env == "" {
		return manifests.DefaultEnvironment
	}
	return *env
}

// checkDeploymentCompatibility compares a proposed manifest against the stored
// latest version and (optionally) persists the resulting check.
func checkDeploymentCompatibility(
	ctx context.Context,
	s *store.PipelineManifestStore,
	pipeline, env string,
	in model.StateManifestInput,
	persist bool,
) (*model.CompatibilityReport, error) {
	oldRow, err := s.Latest(ctx, pipeline, env)
	if err != nil {
		return nil, err
	}
	var old *compatibility.StateManifest
	if oldRow != nil {
		sm, err := manifests.StateManifestFromRow(oldRow)
		if err != nil {
			return nil, err
		}
		old = &sm
	}

	report := compatibility.Compare(old, inputToStateManifest(in))
	out := mapReport(report, pipeline, env)

	if persist {
		issuesJSON, err := json.Marshal(report.Issues)
		if err != nil {
			return nil, fmt.Errorf("marshal issues: %w", err)
		}
		check := storage.DBCompatibilityCheck{
			PipelineName: pipeline,
			Environment:  env,
			Verdict:      string(report.Verdict),
			CanProceed:   report.CanProceed,
			Issues:       issuesJSON,
		}
		if oldRow != nil {
			check.FromManifestID = &oldRow.ID
			check.FromVersion = &oldRow.Version
		}
		id, err := s.SaveCheck(ctx, check)
		if err != nil {
			return nil, err
		}
		idStr := strconv.FormatInt(id, 10)
		out.CheckID = &idStr
		now := time.Now().UTC().Format(time.RFC3339)
		out.CheckedAt = &now
	}

	return out, nil
}

func pipelineManifestVersions(
	ctx context.Context,
	s *store.PipelineManifestStore,
	pipeline, env string,
) ([]*model.PipelineManifestVersion, error) {
	rows, err := s.ListVersions(ctx, pipeline, env, 0)
	if err != nil {
		return nil, err
	}
	out := make([]*model.PipelineManifestVersion, 0, len(rows))
	for i := range rows {
		out = append(out, mapManifestVersion(&rows[i]))
	}
	return out, nil
}

func latestCompatibilityReport(
	ctx context.Context,
	s *store.PipelineManifestStore,
	pipeline, env string,
) (*model.CompatibilityReport, error) {
	check, err := s.LatestCheck(ctx, pipeline, env)
	if err != nil {
		return nil, err
	}
	if check == nil {
		return nil, nil
	}

	var issues []compatibility.Issue
	if len(check.Issues) > 0 {
		if err := json.Unmarshal(check.Issues, &issues); err != nil {
			return nil, fmt.Errorf("unmarshal issues: %w", err)
		}
	}
	out := mapReport(compatibility.Report{
		Verdict:    compatibility.Verdict(check.Verdict),
		CanProceed: check.CanProceed,
		Issues:     issues,
	}, pipeline, env)
	checkedAt := check.CheckedAt.UTC().Format(time.RFC3339)
	out.CheckedAt = &checkedAt
	idStr := strconv.FormatInt(check.ID, 10)
	out.CheckID = &idStr
	return out, nil
}

func restoreEvents(
	ctx context.Context,
	s *store.PipelineManifestStore,
	pipeline, env string,
) ([]*model.RestoreEvent, error) {
	rows, err := s.ListRestoreEvents(ctx, pipeline, env, 0)
	if err != nil {
		return nil, err
	}
	out := make([]*model.RestoreEvent, 0, len(rows))
	for i := range rows {
		out = append(out, mapRestoreEvent(&rows[i]))
	}
	return out, nil
}

func pipelineStateSummaries(
	ctx context.Context,
	s *store.PipelineManifestStore,
	environment *string,
) ([]*model.PipelineStateSummary, error) {
	rows, err := s.ListPipelineSummaries(ctx, environment)
	if err != nil {
		return nil, err
	}
	out := make([]*model.PipelineStateSummary, 0, len(rows))
	for i := range rows {
		out = append(out, mapPipelineSummary(&rows[i]))
	}
	return out, nil
}

// ── mappers ─────────────────────────────────────────────────────────

func inputToStateManifest(in model.StateManifestInput) compatibility.StateManifest {
	ops := make([]compatibility.OperatorState, 0, len(in.Operators))
	for _, o := range in.Operators {
		if o == nil {
			continue
		}
		keys := make([]compatibility.KeyField, 0, len(o.KeyFields))
		for _, k := range o.KeyFields {
			if k == nil {
				continue
			}
			keys = append(keys, compatibility.KeyField{Name: k.Name, Type: k.Type})
		}
		ops = append(ops, compatibility.OperatorState{
			LogicalKey:     o.LogicalKey,
			NodeID:         o.NodeID,
			Component:      o.Component,
			StateRole:      o.StateRole,
			KeyFields:      keys,
			ChangelogMode:  o.ChangelogMode,
			TTL:            o.TTL,
			MaxParallelism: o.MaxParallelism,
			OperatorHash:   o.OperatorHash,
		})
	}
	return compatibility.StateManifest{
		SchemaVersion: in.SchemaVersion,
		PipelineName:  in.PipelineName,
		FlinkVersion:  in.FlinkVersion,
		Operators:     ops,
		Fingerprint:   in.Fingerprint,
	}
}

func mapReport(r compatibility.Report, pipeline, environment string) *model.CompatibilityReport {
	issues := make([]*model.CompatibilityIssue, 0, len(r.Issues))
	for _, i := range r.Issues {
		issues = append(issues, &model.CompatibilityIssue{
			OperatorKey: i.OperatorKey,
			Component:   i.Component,
			Category:    i.Category,
			Severity:    model.IssueSeverity(i.Severity),
			Message:     i.Message,
		})
	}
	return &model.CompatibilityReport{
		Pipeline:    pipeline,
		Environment: environment,
		Verdict:     model.CompatibilityVerdict(r.Verdict),
		CanProceed:  r.CanProceed,
		Issues:      issues,
	}
}

func mapManifestVersion(row *storage.DBPipelineManifest) *model.PipelineManifestVersion {
	return &model.PipelineManifestVersion{
		ID:               strconv.FormatInt(row.ID, 10),
		Pipeline:         row.PipelineName,
		Environment:      row.Environment,
		Version:          row.Version,
		FlinkVersion:     row.FlinkVersion,
		StateFingerprint: row.StateFingerprint,
		Source:           row.Source,
		CreatedAt:        row.CreatedAt.UTC().Format(time.RFC3339),
		ManifestJSON:     string(row.Manifest),
	}
}

func mapRestoreEvent(row *storage.DBRestoreEvent) *model.RestoreEvent {
	ev := &model.RestoreEvent{
		ID:            strconv.FormatInt(row.ID, 10),
		Pipeline:      row.PipelineName,
		Environment:   row.Environment,
		Cluster:       row.Cluster,
		Jid:           row.JID,
		Outcome:       row.Outcome,
		ErrorCategory: row.ErrorCategory,
		BlueGreenName: row.BlueGreenName,
		ObservedAt:    row.ObservedAt.UTC().Format(time.RFC3339),
	}
	if row.RestoredCheckpointID != nil {
		v := int(*row.RestoredCheckpointID)
		ev.RestoredCheckpointID = &v
	}
	return ev
}

func mapPipelineSummary(row *store.PipelineSummaryRow) *model.PipelineStateSummary {
	sum := &model.PipelineStateSummary{
		Pipeline:         row.PipelineName,
		Environment:      row.Environment,
		LatestVersion:    row.LatestVersion,
		VersionCount:     row.VersionCount,
		StateFingerprint: row.StateFingerprint,
		FlinkVersion:     row.FlinkVersion,
		LastIssueCount:   row.LastIssueCount,
		RestoreTotal:     row.RestoreTotal,
		RestoreSuccess:   row.RestoreSuccess,
		UpdatedAt:        row.CreatedAt.UTC().Format(time.RFC3339),
	}
	if row.LastVerdict != nil {
		v := model.CompatibilityVerdict(*row.LastVerdict)
		sum.LastVerdict = &v
	}
	if row.LastCheckedAt != nil {
		ts := row.LastCheckedAt.UTC().Format(time.RFC3339)
		sum.LastCheckedAt = &ts
	}
	return sum
}
