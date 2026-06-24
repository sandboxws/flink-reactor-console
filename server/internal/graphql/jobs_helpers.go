package graphql

import (
	"context"
	"log/slog"
	"sort"
	"strconv"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/savepoints"
)

// jobRatesTimeout bounds the per-job rate fan-out so one slow job doesn't
// stall the entire `jobs` query.
const jobRatesTimeout = 2 * time.Second

// enrichJobsWithRates fans out across RUNNING jobs to populate the
// throughput / watermark-lag fields on each JobOverview. Each per-job fetch
// runs with its own short timeout so one stalled job can't block the entire
// list; failures leave the rate fields nil rather than failing the query.
func enrichJobsWithRates(ctx context.Context, svc *flink.Service, jobs []*model.JobOverview) {
	var (
		mu  sync.Mutex
		g   errgroup.Group
		log = slog.Default()
	)
	g.SetLimit(10)

	for _, job := range jobs {
		if job.State != "RUNNING" {
			continue
		}
		g.Go(func() error {
			jobCtx, cancel := context.WithTimeout(ctx, jobRatesTimeout)
			defer cancel()

			agg, err := svc.GetJobRates(jobCtx, job.ID)
			if err != nil {
				log.Warn("jobs: rate fetch failed", "jobID", job.ID, "error", err)
				return nil
			}

			metrics := computeJobMetrics(agg)
			lag := computeWatermarkLagInt(agg)

			mu.Lock()
			defer mu.Unlock()
			if metrics != nil {
				rin := metrics.RecordsInPerSecond
				rout := metrics.RecordsOutPerSecond
				job.RecordsInPerSecond = &rin
				job.RecordsOutPerSecond = &rout
			}
			if lag != nil {
				job.WatermarkLag = lag
			}
			return nil
		})
	}

	// Error returns are intentionally swallowed inside the goroutines, so
	// Wait can only return nil — but we still wait for all fan-outs to finish
	// before returning to the caller.
	_ = g.Wait()
}

// mapSavepoint converts a Flink SavepointInfo into the GraphQL model.
//
// Status mapping: Flink reports operations as IN_PROGRESS or COMPLETED. A
// completed operation with a non-empty failure-cause is surfaced as FAILED so
// the dashboard can render the error string in the savepoint row.
func mapSavepoint(op *flink.SavepointInfo, cluster, jobID string, cache *savepoints.TriggerTypeCache) *model.Savepoint {
	status := model.SavepointStatusInProgress
	var errStr *string
	switch op.Status.ID {
	case "COMPLETED":
		if op.Operation.FailureCause != "" {
			status = model.SavepointStatusFailed
			s := op.Operation.FailureCause
			errStr = &s
		} else {
			status = model.SavepointStatusCompleted
		}
	case "IN_PROGRESS":
		status = model.SavepointStatusInProgress
	}

	triggerType := model.SavepointTriggerTypeManual
	if cache != nil {
		switch cache.Lookup(cluster, jobID, op.OperationID) {
		case savepoints.TriggerStopWithSavepoint:
			triggerType = model.SavepointTriggerTypeStopWithSavepoint
		case savepoints.TriggerBlueGreen:
			triggerType = model.SavepointTriggerTypeBlueGreen
		default:
			triggerType = model.SavepointTriggerTypeManual
		}
	}

	var location *string
	if op.Operation.Location != "" {
		l := op.Operation.Location
		location = &l
	}
	var sizeBytes *string
	if op.SizeBytes > 0 {
		s := strconv.FormatInt(op.SizeBytes, 10)
		sizeBytes = &s
	}
	var durationMs *string
	if op.DurationMs > 0 {
		d := strconv.FormatInt(op.DurationMs, 10)
		durationMs = &d
	}

	return &model.Savepoint{
		ID:          op.OperationID,
		Status:      status,
		TriggerType: triggerType,
		Location:    location,
		SizeBytes:   sizeBytes,
		DurationMs:  durationMs,
		TriggeredAt: strconv.FormatInt(op.TriggerTimestamp, 10),
		Error:       errStr,
	}
}

// nilIfEmpty returns a pointer to s, or nil when s is empty — for mapping a
// possibly-absent string field onto a nullable GraphQL String.
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// mapRescaleEvent converts a Flink RescaleEventInfo into the GraphQL model
// (Flink 2.3+, FLIP-495). Unknown status values degrade to IN_PROGRESS;
// optional numeric/duration fields are nil until populated.
func mapRescaleEvent(e *flink.RescaleEventInfo) *model.RescaleEvent {
	status := model.RescaleStatus(e.Status)
	switch status {
	case model.RescaleStatusPending, model.RescaleStatusInProgress,
		model.RescaleStatusCompleted, model.RescaleStatusFailed:
	default:
		status = model.RescaleStatusInProgress
	}

	var durationMs *string
	if e.Duration > 0 {
		d := strconv.FormatInt(e.Duration, 10)
		durationMs = &d
	}
	var parallelismBefore, parallelismAfter *int
	if e.ParallelismBefore > 0 {
		v := e.ParallelismBefore
		parallelismBefore = &v
	}
	if e.ParallelismAfter > 0 {
		v := e.ParallelismAfter
		parallelismAfter = &v
	}

	return &model.RescaleEvent{
		UUID:              e.UUID,
		Status:            status,
		TriggeredAt:       strconv.FormatInt(e.TriggerTimestamp, 10),
		DurationMs:        durationMs,
		ParallelismBefore: parallelismBefore,
		ParallelismAfter:  parallelismAfter,
		Error:             nilIfEmpty(e.FailureCause),
	}
}

// sortSavepointsByTriggeredAtDesc sorts in-place by triggeredAt descending.
// Used by the savepoints query to fulfil the spec's "most recently triggered
// first" requirement.
func sortSavepointsByTriggeredAtDesc(in []*model.Savepoint) {
	sort.SliceStable(in, func(i, j int) bool {
		a, _ := strconv.ParseInt(in[i].TriggeredAt, 10, 64)
		b, _ := strconv.ParseInt(in[j].TriggeredAt, 10, 64)
		return a > b
	})
}
