package alerts

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/sandboxws/flink-reactor-console/server/internal/cluster"
	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
	"github.com/sandboxws/flink-reactor-console/server/internal/store"
)

// stabilization is the window after a rule stops firing for a (rule, dedup_key)
// before the auto-resolver promotes the open instance to RESOLVED.
const stabilization = 30 * time.Second

// evalWorkers bounds the concurrent condition evaluations per tick.
const evalWorkers = 8

// Evaluator drives the rule-evaluation loop. On each tick it builds a
// ClusterSnapshot per cluster and dispatches all enabled rules against the
// snapshot via a bounded worker pool. Firing rules open or refresh an
// instance via AlertStore.OpenInstance.
type Evaluator struct {
	stores  *store.Stores
	manager *cluster.Manager
	logger  *slog.Logger
	tick    time.Duration

	cancel context.CancelFunc
}

// NewEvaluator constructs an Evaluator. tick is the snapshot interval.
func NewEvaluator(stores *store.Stores, manager *cluster.Manager, tick time.Duration, logger *slog.Logger) *Evaluator {
	if tick <= 0 {
		tick = 5 * time.Second
	}
	return &Evaluator{stores: stores, manager: manager, logger: logger, tick: tick}
}

// Start spawns the evaluation and auto-resolve goroutines.
func (e *Evaluator) Start(ctx context.Context) {
	ctx, e.cancel = context.WithCancel(ctx)

	go e.runLoop(ctx)
	go e.runAutoResolve(ctx)
}

// Stop cancels the evaluation goroutine.
func (e *Evaluator) Stop() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *Evaluator) runLoop(ctx context.Context) {
	ticker := time.NewTicker(e.tick)
	defer ticker.Stop()

	// Initial eval.
	e.evaluateAll(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.evaluateAll(ctx)
		}
	}
}

func (e *Evaluator) evaluateAll(ctx context.Context) {
	rules, err := e.stores.Alerts.ListRules(ctx, true)
	if err != nil {
		e.logger.Warn("alerts: list rules failed", "error", err)
		return
	}
	if len(rules) == 0 {
		return
	}

	clusters := e.manager.List()
	for _, info := range clusters {
		snap := e.snapshot(ctx, info.Name)
		e.dispatch(ctx, snap, rules)
	}
}

// snapshot collects all data needed by condition evaluators in one pass.
// Best-effort: nil overview / empty TM list / -1 success rate signal missing data.
func (e *Evaluator) snapshot(ctx context.Context, clusterName string) ClusterSnapshot {
	snap := ClusterSnapshot{Cluster: clusterName, CheckpointSuccessRate: -1}

	conn, err := e.manager.Get(clusterName)
	if err != nil {
		return snap
	}

	if ov, err := conn.Service.GetClusterOverview(ctx); err == nil {
		snap.Overview = ov
	}
	if tms, err := conn.Service.GetTaskManagers(ctx); err == nil {
		snap.TaskManagers = tms.TaskManagers
	}
	snap.TMMetrics = e.tmMemoryMetrics(ctx, clusterName)
	if jobs, err := conn.Service.GetJobs(ctx); err == nil {
		snap.Jobs = jobs.Jobs
	}
	snap.CheckpointSuccessRate = e.checkpointSuccessRate(ctx, conn, snap.Jobs)

	return snap
}

// tmMemoryMetricIDs are the live TM gauges the evaluator reads from the metric
// store so memory conditions can see managed/off-heap/metaspace pressure — the
// native-memory blind spot behind OOMKills — not just heap, plus the GC rate
// used by GC_PRESSURE.
var tmMemoryMetricIDs = []string{
	"Status.JVM.Memory.Heap.Used",
	"Status.Flink.Memory.Managed.Used",
	"Status.JVM.Memory.Metaspace.Used",
	"Status.Shuffle.Netty.UsedMemory",
	"Status.JVM.GarbageCollector.G1_Young_Generation.TimeMsPerSecond",
	"Status.JVM.GarbageCollector.G1_Old_Generation.TimeMsPerSecond",
}

// tmMemoryMetrics reads the latest persisted memory gauges per TM (keyed
// tmID -> metricID -> value). Best-effort: returns nil on error or when the
// store has no recent data, so evalTMMemory falls back to the heap proxy.
func (e *Evaluator) tmMemoryMetrics(ctx context.Context, clusterName string) map[string]map[string]float64 {
	if e.stores == nil || e.stores.Metrics == nil {
		return nil
	}
	m, err := e.stores.Metrics.LatestMetricValues(ctx, clusterName, "task_manager", tmMemoryMetricIDs, 2*time.Minute)
	if err != nil {
		e.logger.Warn("alerts: latest TM memory metrics failed", "cluster", clusterName, "error", err)
		return nil
	}
	return m
}

// checkpointSuccessRate looks at the most recent checkpoints across running
// jobs and returns an aggregate success rate (0–100), or -1 if unavailable.
func (e *Evaluator) checkpointSuccessRate(_ context.Context, _ *cluster.Connection, jobs []flink.JobOverview) float64 {
	if len(jobs) == 0 {
		return -1
	}
	// Inexpensive proxy: use overview success counts vs failures from the
	// jobs list directly. A richer impl would aggregate per-job /checkpoints
	// responses; that's a follow-up.
	var ok, fail int
	for _, j := range jobs {
		ok += j.Tasks.Finished
		fail += j.Tasks.Failed
	}
	total := ok + fail
	if total == 0 {
		return -1
	}
	return float64(ok) / float64(total) * 100.0
}

// dispatch runs every rule against the snapshot using a bounded worker pool.
func (e *Evaluator) dispatch(ctx context.Context, snap ClusterSnapshot, rules []storage.DBAlertRule) {
	sem := make(chan struct{}, evalWorkers)
	done := make(chan struct{}, len(rules))

	for i := range rules {
		sem <- struct{}{}
		go func(r storage.DBAlertRule) {
			defer func() {
				<-sem
				done <- struct{}{}
			}()
			e.evaluateRule(ctx, snap, r)
		}(rules[i])
	}
	for range rules {
		select {
		case <-done:
		case <-ctx.Done():
			return
		}
	}
}

func (e *Evaluator) evaluateRule(ctx context.Context, snap ClusterSnapshot, rule storage.DBAlertRule) {
	cond, err := DecodeCondition(rule.Condition)
	if err != nil {
		e.logger.Warn("alerts: skip rule with invalid condition", "rule_id", rule.ID, "error", err)
		return
	}
	results := EvaluateCondition(snap, cond)
	for _, r := range results {
		if !r.Fired {
			continue
		}
		ctxJSON, _ := json.Marshal(r.Context)
		cv := r.CurrentValue
		_, _, err := e.stores.Alerts.OpenInstance(ctx, rule.ID, r.DedupKey, ctxJSON, &cv, r.Message)
		if err != nil {
			e.logger.Warn("alerts: open instance failed", "rule_id", rule.ID, "dedup", r.DedupKey, "error", err)
		}
	}
}

// runAutoResolve runs a slower tick that scans for open instances whose
// last_seen_at is older than the stabilization window and transitions them
// to RESOLVED.
func (e *Evaluator) runAutoResolve(ctx context.Context) {
	ticker := time.NewTicker(stabilization / 2)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cutoff := time.Now().Add(-stabilization)
			stale, err := e.stores.Alerts.ListStaleOpenInstances(ctx, cutoff)
			if err != nil {
				e.logger.Warn("alerts: list stale failed", "error", err)
				continue
			}
			for _, inst := range stale {
				if _, err := e.stores.Alerts.TransitionInstance(ctx, inst.ID, storage.AlertStateResolved); err != nil {
					e.logger.Warn("alerts: auto-resolve failed", "instance_id", inst.ID, "error", err)
				}
			}
		}
	}
}
