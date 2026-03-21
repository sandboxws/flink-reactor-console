package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
)

// jobDetailFromDB builds a JobDetail from database records when the Flink REST
// API returns 404 (job no longer in runtime). Returns nil if no DB record exists.
//
// Strategy:
// 1. Try JSONB snapshot → unmarshal to JobDetailAggregate → shared mapper (perfect parity)
// 2. Fallback to normalized tables for pre-migration jobs (graceful degradation)
func (r *Resolver) jobDetailFromDB(ctx context.Context, id string) (*model.JobDetail, error) {
	if r.Stores == nil {
		return nil, nil
	}

	job, err := r.Stores.Jobs.GetJobByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("db fallback: %w", err)
	}
	if job == nil {
		return nil, nil
	}

	// Path 1: JSONB snapshot — full parity with live view.
	if len(job.DetailSnapshot) > 0 {
		var agg flink.JobDetailAggregate
		if err := json.Unmarshal(job.DetailSnapshot, &agg); err == nil && agg.Job != nil {
			return mapJobDetailAggregate(&agg), nil
		}
	}

	// Path 2: Normalized tables — graceful fallback for pre-migration jobs.
	return r.jobDetailFromNormalized(ctx, id, job)
}

// jobDetailFromNormalized reconstructs a JobDetail from normalized DB tables.
// Used as a fallback when no JSONB snapshot exists (pre-migration jobs).
func (r *Resolver) jobDetailFromNormalized(ctx context.Context, id string, job *storage.DBJob) (*model.JobDetail, error) {
	// Map vertices from DB.
	dbVertices, err := r.Stores.Jobs.QueryVerticesByJob(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("db fallback vertices: %w", err)
	}
	vertices := make([]*model.JobVertex, len(dbVertices))
	for i, v := range dbVertices {
		vertices[i] = mapDBVertex(&v)
	}

	// Map exceptions from DB.
	var exceptions []*model.ExceptionEntry
	dbExceptions, _, err := r.Stores.Exceptions.QueryExceptions(ctx, store.ExceptionFilter{
		JobID: &id,
	}, store.CursorPagination{First: 1000})
	if err == nil {
		for _, e := range dbExceptions {
			exceptions = append(exceptions, mapDBException(&e))
		}
	}

	// Map checkpoints from DB.
	var checkpoints *model.CheckpointStats
	dbCheckpoints, _, err := r.Stores.Checkpoints.QueryCheckpoints(ctx, store.CheckpointFilter{
		JobID: &id,
	}, store.CursorPagination{First: 1000})
	if err == nil && len(dbCheckpoints) > 0 {
		checkpoints = mapDBCheckpoints(dbCheckpoints)
	}

	return &model.JobDetail{
		ID:          job.JID,
		Name:        job.Name,
		State:       job.State,
		StartTime:   timeToI64(job.StartTime),
		EndTime:     timeToI64(job.EndTime),
		Duration:    i64(job.DurationMs),
		Now:         i64(time.Now().UnixMilli()),
		Vertices:    vertices,
		Plan:        &model.JobPlan{Jid: job.JID, Name: job.Name},
		Exceptions:  exceptions,
		Checkpoints: checkpoints,
	}, nil
}

// timeToI64 converts a *time.Time to a millisecond-epoch string.
func timeToI64(t *time.Time) string {
	if t == nil || t.IsZero() {
		return "0"
	}
	return strconv.FormatInt(t.UnixMilli(), 10)
}

// mapDBVertex converts a DB vertex to a GraphQL JobVertex.
func mapDBVertex(v *storage.DBVertex) *model.JobVertex {
	return &model.JobVertex{
		ID:             v.ID,
		Name:           v.Name,
		Parallelism:    v.Parallelism,
		MaxParallelism: v.MaxParallelism,
		Status:         v.Status,
		StartTime:      timeToI64(v.StartTime),
		EndTime:        timeToI64(v.EndTime),
		Duration:       i64(v.DurationMs),
		Tasks:          &model.TaskCounts{},
		Metrics: &model.VertexMetrics{
			ReadBytes:    f64(v.ReadBytes),
			WriteBytes:   f64(v.WriteBytes),
			ReadRecords:  f64(v.ReadRecords),
			WriteRecords: f64(v.WriteRecords),
		},
	}
}

// mapDBException converts a DB exception to a GraphQL ExceptionEntry.
func mapDBException(e *storage.DBException) *model.ExceptionEntry {
	return &model.ExceptionEntry{
		ExceptionName: e.ExceptionName,
		Stacktrace:    e.Stacktrace,
		Timestamp:     i64(e.Timestamp.UnixMilli()),
		TaskName:      e.TaskName,
		Endpoint:      e.Endpoint,
		TaskManagerID: e.TaskManagerID,
	}
}

// mapDBCheckpoints builds a CheckpointStats from DB checkpoint records.
func mapDBCheckpoints(cps []storage.DBCheckpoint) *model.CheckpointStats {
	history := make([]*model.CheckpointHistoryEntry, len(cps))
	for i, c := range cps {
		history[i] = &model.CheckpointHistoryEntry{
			ID:                      i64(c.CheckpointID),
			Status:                  c.Status,
			IsSavepoint:             c.IsSavepoint,
			TriggerTimestamp:        timeToI64(c.TriggerTimestamp),
			LatestAckTimestamp:      timeToI64(c.LatestAck),
			StateSize:               i64(c.StateSize),
			EndToEndDuration:        i64(c.EndToEndDuration),
			ProcessedData:           i64(c.ProcessedData),
			PersistedData:           i64(c.PersistedData),
			NumSubtasks:             c.NumSubtasks,
			NumAcknowledgedSubtasks: c.NumAckSubtasks,
			CheckpointedSize:        i64p(c.CheckpointedSize),
		}
	}

	// Compute counts from history.
	var completed, failed, inProgress int
	for _, c := range cps {
		switch c.Status {
		case "COMPLETED":
			completed++
		case "FAILED":
			failed++
		case "IN_PROGRESS":
			inProgress++
		}
	}

	return &model.CheckpointStats{
		Counts: &model.CheckpointCounts{
			Total:      len(cps),
			Completed:  completed,
			Failed:     failed,
			InProgress: inProgress,
		},
		History: history,
	}
}
