package graphql

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/sandboxws/flink-reactor-console/server/internal/connector"
	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
)

// mapJobDetailAggregate converts a full Flink JobDetailAggregate to a GraphQL JobDetail.
// This is the single shared mapper used by both the live Flink path and the DB snapshot path.
func mapJobDetailAggregate(agg *flink.JobDetailAggregate) *model.JobDetail {
	job := agg.Job

	// Map vertices.
	vertices := make([]*model.JobVertex, len(job.Vertices))
	for i, v := range job.Vertices {
		vertices[i] = mapVertex(&v)
	}

	// Map plan nodes.
	planNodes := make([]*model.PlanNode, len(job.Plan.Nodes))
	for i, n := range job.Plan.Nodes {
		var inputs []*model.PlanNodeInput
		for _, inp := range n.Inputs {
			inputs = append(inputs, &model.PlanNodeInput{
				Num:          inp.Num,
				ID:           inp.ID,
				ShipStrategy: inp.ShipStrategy,
				Exchange:     inp.Exchange,
			})
		}
		planNodes[i] = &model.PlanNode{
			ID:               n.ID,
			Parallelism:      n.Parallelism,
			Operator:         n.Operator,
			OperatorStrategy: n.OperatorStrategy,
			Description:      n.Description,
			Inputs:           inputs,
		}
	}

	// Map exceptions.
	var exceptions []*model.ExceptionEntry
	if agg.Exceptions != nil {
		for _, e := range agg.Exceptions.ExceptionHistory.Entries {
			exceptions = append(exceptions, &model.ExceptionEntry{
				ExceptionName: e.ExceptionName,
				Stacktrace:    e.Stacktrace,
				Timestamp:     i64(e.Timestamp),
				TaskName:      e.TaskName,
				Endpoint:      e.Endpoint,
				TaskManagerID: e.TaskManagerID,
			})
		}
	}

	// Map checkpoints.
	var checkpoints *model.CheckpointStats
	if agg.Checkpoints != nil {
		checkpoints = mapCheckpointStats(agg.Checkpoints)
	}

	// Map checkpoint config.
	var cpConfig *model.CheckpointConfig
	if agg.CheckpointConfig != nil {
		cc := agg.CheckpointConfig
		cpConfig = &model.CheckpointConfig{
			Mode:                             cc.Mode,
			Interval:                         i64(cc.Interval),
			Timeout:                          i64(cc.Timeout),
			MinPause:                         i64(cc.MinPause),
			MaxConcurrent:                    cc.MaxConcurrent,
			ExternalizedEnabled:              cc.Externalization.Enabled,
			ExternalizedDeleteOnCancellation: cc.Externalization.DeleteOnCancellation,
			UnalignedCheckpoints:             cc.UnalignedCheckpoints,
		}
	}

	// Map vertex details.
	var vertexDetails []*model.VertexDetail
	for vid, vd := range agg.VertexDetails {
		vertexDetails = append(vertexDetails, mapVertexDetail(vid, vd))
	}

	// Map watermarks.
	var watermarks []*model.VertexWatermarks
	for vid, wms := range agg.Watermarks {
		entries := make([]*model.WatermarkEntry, len(wms))
		for i, w := range wms {
			entries[i] = &model.WatermarkEntry{ID: w.ID, Value: w.Value}
		}
		watermarks = append(watermarks, &model.VertexWatermarks{
			VertexID:   vid,
			Watermarks: entries,
		})
	}

	// Map backpressure.
	var backPressure []*model.VertexBackPressure
	for vid, bp := range agg.BackPressure {
		subtasks := make([]*model.SubtaskBackPressure, len(bp.Subtasks))
		for i, s := range bp.Subtasks {
			subtasks[i] = &model.SubtaskBackPressure{
				Subtask:           s.Subtask,
				AttemptNumber:     s.AttemptNumber,
				BackpressureLevel: s.BackpressureLevel,
				Ratio:             s.Ratio,
				BusyRatio:         s.BusyRatio,
				IdleRatio:         s.IdleRatio,
			}
		}
		backPressure = append(backPressure, &model.VertexBackPressure{
			VertexID: vid,
			BackPressure: &model.BackPressureInfo{
				Status:            bp.Status,
				BackpressureLevel: bp.BackpressureLevel,
				EndTimestamp:      i64(bp.EndTimestamp),
				Subtasks:          subtasks,
			},
		})
	}

	// Map accumulators.
	var accumulators []*model.VertexAccumulators
	for vid, acc := range agg.Accumulators {
		entries := make([]*model.UserAccumulator, len(acc.UserAccumulators))
		for i, a := range acc.UserAccumulators {
			entries[i] = &model.UserAccumulator{
				Name:  a.Name,
				Type:  a.Type,
				Value: a.Value,
			}
		}
		accumulators = append(accumulators, &model.VertexAccumulators{
			VertexID:     vid,
			Accumulators: entries,
		})
	}

	return &model.JobDetail{
		ID:        job.JID,
		Name:      job.Name,
		State:     job.State,
		StartTime: i64(job.StartTime),
		EndTime:   i64(job.EndTime),
		Duration:  i64(job.Duration),
		Now:       i64(job.Now),
		Vertices:  vertices,
		Plan: &model.JobPlan{
			Jid:   job.Plan.JID,
			Name:  job.Plan.Name,
			Type:  job.Plan.Type,
			Nodes: planNodes,
		},
		Exceptions:       exceptions,
		Checkpoints:      checkpoints,
		CheckpointConfig: cpConfig,
		JobConfig:        mapJobConfig(agg.JobConfig),
		RestartInfo:      mapRestartInfo(agg.JobConfig, agg.RestartMetrics),
		VertexDetails:    vertexDetails,
		Watermarks:       watermarks,
		BackPressure:     backPressure,
		Accumulators:     accumulators,
		Metrics:          computeJobMetrics(agg),
		WatermarkLag:     computeWatermarkLag(agg),
	}
}

// computeJobMetrics aggregates per-vertex per-second rates into job-level
// throughput. recordsInPerSecond is the sum of numRecordsOutPerSecond across
// source vertices (records flowing into the pipeline); recordsOutPerSecond
// is the sum of numRecordsInPerSecond across sink vertices (records reaching
// the pipeline's terminal stage). Returns nil when no rate data is available.
func computeJobMetrics(agg *flink.JobDetailAggregate) *model.JobMetrics {
	if agg == nil || agg.Job == nil || len(agg.VertexRates) == 0 {
		return nil
	}

	sourceIDs, sinkIDs := classifyVertices(&agg.Job.Plan)

	var inRate, outRate float64
	for _, vid := range sourceIDs {
		inRate += extractAggSum(agg.VertexRates[vid], "numRecordsOutPerSecond")
	}
	for _, vid := range sinkIDs {
		outRate += extractAggSum(agg.VertexRates[vid], "numRecordsInPerSecond")
	}

	return &model.JobMetrics{
		RecordsInPerSecond:  inRate,
		RecordsOutPerSecond: outRate,
	}
}

// classifyVertices walks the plan to identify source and sink vertex IDs.
// Sources have no inputs. Sinks are vertices that no other vertex references
// as an input, OR whose operator label starts with "Sink:".
func classifyVertices(plan *flink.JobPlan) (sources, sinks []string) {
	if plan == nil || len(plan.Nodes) == 0 {
		return nil, nil
	}

	referenced := make(map[string]bool, len(plan.Nodes))
	for _, n := range plan.Nodes {
		for _, in := range n.Inputs {
			referenced[in.ID] = true
		}
	}

	for _, n := range plan.Nodes {
		if len(n.Inputs) == 0 {
			sources = append(sources, n.ID)
		}
		if !referenced[n.ID] || strings.HasPrefix(strings.TrimSpace(n.Operator), "Sink:") {
			sinks = append(sinks, n.ID)
		}
	}
	return sources, sinks
}

// extractAggSum returns the `sum` of the named aggregated subtask metric (the
// total across all subtasks of a vertex). Returns 0 when the metric is missing
// or the value is non-finite.
func extractAggSum(items []flink.AggregatedSubtaskMetric, id string) float64 {
	for _, m := range items {
		if m.ID != id {
			continue
		}
		if math.IsNaN(m.Sum) || math.IsInf(m.Sum, 0) {
			return 0
		}
		return m.Sum
	}
	return 0
}

// computeWatermarkLagMs returns `now - min subtask watermark` (in ms),
// or nil when no valid watermark exists. Filters Flink's sentinel values
// (Long.MIN_VALUE = "no watermark", Long.MAX_VALUE = "end of stream")
// and zero. Shared by both JobDetail (which stringifies the result) and
// JobOverview (which serializes it as a GraphQL Int).
func computeWatermarkLagMs(agg *flink.JobDetailAggregate) *int64 {
	if agg == nil || agg.Job == nil || len(agg.Watermarks) == 0 {
		return nil
	}

	const (
		longMin int64 = math.MinInt64
		longMax int64 = math.MaxInt64
	)

	var minWatermark int64 = longMax
	found := false
	for _, entries := range agg.Watermarks {
		for _, e := range entries {
			v, err := strconv.ParseInt(e.Value, 10, 64)
			if err != nil || v <= 0 || v == longMin || v == longMax {
				continue
			}
			if v < minWatermark {
				minWatermark = v
				found = true
			}
		}
	}
	if !found {
		return nil
	}

	lag := max(agg.Job.Now-minWatermark, 0)
	return &lag
}

// computeWatermarkLag returns the lag stringified as a Long, for JobDetail
// (which uses String to safely encode lags that may exceed int32).
func computeWatermarkLag(agg *flink.JobDetailAggregate) *string {
	lag := computeWatermarkLagMs(agg)
	if lag == nil {
		return nil
	}
	s := strconv.FormatInt(*lag, 10)
	return &s
}

// computeWatermarkLagInt returns the lag as a GraphQL Int (int32-clamped),
// for JobOverview. Lags exceeding int32 (~24.85 days) are clamped — at that
// magnitude the exact value is meaningless and we just want a "very stale"
// signal that still fits the schema.
func computeWatermarkLagInt(agg *flink.JobDetailAggregate) *int {
	lag := computeWatermarkLagMs(agg)
	if lag == nil {
		return nil
	}
	clamped := int(min(*lag, math.MaxInt32))
	return &clamped
}

// mapJobConfig converts the Flink JobConfig (raw /jobs/:id/config response) into a
// GraphQL JobConfig. The user-config map is emitted as a list of ConfigEntry sorted
// by key so the wire payload is deterministic.
func mapJobConfig(jc *flink.JobConfig) *model.JobConfig {
	if jc == nil {
		return nil
	}
	uc := jc.ExecutionConfig.UserConfig
	keys := make([]string, 0, len(uc))
	for k := range uc {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	entries := make([]*model.ConfigEntry, len(keys))
	for i, k := range keys {
		entries[i] = &model.ConfigEntry{Key: k, Value: uc[k]}
	}
	return &model.JobConfig{
		Jid:             jc.JID,
		Name:            jc.Name,
		ExecutionMode:   jc.ExecutionConfig.ExecutionMode,
		RestartStrategy: jc.ExecutionConfig.RestartStrategy,
		JobParallelism:  jc.ExecutionConfig.JobParallelism,
		ObjectReuseMode: jc.ExecutionConfig.ObjectReuseMode,
		UserConfig:      entries,
	}
}

// mapHAStatus derives high-availability status from the raw /jobmanager/config
// key-value list. It prefers the modern `high-availability.type` key and falls
// back to the legacy `high-availability` key (renamed at Flink 1.x -> 2.0).
// Only the HA-related subset of the config is exposed -- no other keys leak.
func mapHAStatus(config []flink.JMConfigEntry) *model.HAStatus {
	get := func(key string) (string, bool) {
		for _, e := range config {
			if e.Key == key {
				return e.Value, true
			}
		}
		return "", false
	}

	mode, ok := get("high-availability.type")
	if !ok || strings.TrimSpace(mode) == "" {
		mode, _ = get("high-availability") // legacy fallback
	}
	mode = strings.TrimSpace(mode)

	switch strings.ToLower(mode) {
	case "", "none", "disabled":
		return &model.HAStatus{Enabled: false, Mode: "NONE"}
	}

	ha := &model.HAStatus{Enabled: true, Mode: mode}
	if sd, ok := get("high-availability.storageDir"); ok {
		if t := strings.TrimSpace(sd); t != "" {
			ha.StorageDir = &t
		}
	}
	if cid, ok := get("high-availability.cluster-id"); ok {
		if t := strings.TrimSpace(cid); t != "" {
			ha.ClusterID = &t
		}
	}
	return ha
}

// mapRestartInfo builds a per-job failover/restart summary from job-level
// reliability metrics (numRestarts / fullRestarts / uptime / downtime) and the
// job config's restart strategy. An absent metric maps to nil (unknown), never
// zero. uptime/downtime are emitted as Long-safe millisecond strings.
func mapRestartInfo(jc *flink.JobConfig, metrics []flink.MetricItem) *model.RestartInfo {
	byID := make(map[string]string, len(metrics))
	for _, m := range metrics {
		byID[m.ID] = m.Value
	}

	intPtr := func(id string) *int {
		v, ok := byID[id]
		if !ok {
			return nil
		}
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil {
			return nil
		}
		n := int(f)
		return &n
	}
	msPtr := func(id string) *string {
		v, ok := byID[id]
		if !ok {
			return nil
		}
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil {
			return nil
		}
		s := strconv.FormatInt(int64(f), 10)
		return &s
	}

	var strategy *string
	if jc != nil && strings.TrimSpace(jc.ExecutionConfig.RestartStrategy) != "" {
		s := jc.ExecutionConfig.RestartStrategy
		strategy = &s
	}

	ri := &model.RestartInfo{
		NumRestarts:     intPtr("numRestarts"),
		FullRestarts:    intPtr("fullRestarts"),
		RestartStrategy: strategy,
		UptimeMs:        msPtr("uptime"),
		DowntimeMs:      msPtr("downtime"),
	}

	if ri.NumRestarts == nil && ri.FullRestarts == nil && ri.RestartStrategy == nil &&
		ri.UptimeMs == nil && ri.DowntimeMs == nil {
		return nil
	}
	return ri
}

// mapVertex converts a Flink Vertex to a GraphQL JobVertex.
func mapVertex(v *flink.Vertex) *model.JobVertex {
	// Vertex tasks use map[string]int with UPPERCASE keys.
	tasks := &model.TaskCounts{
		Created:      v.Tasks["CREATED"],
		Scheduled:    v.Tasks["SCHEDULED"],
		Deploying:    v.Tasks["DEPLOYING"],
		Running:      v.Tasks["RUNNING"],
		Finished:     v.Tasks["FINISHED"],
		Canceling:    v.Tasks["CANCELING"],
		Canceled:     v.Tasks["CANCELED"],
		Failed:       v.Tasks["FAILED"],
		Reconciling:  v.Tasks["RECONCILING"],
		Initializing: v.Tasks["INITIALIZING"],
	}

	return &model.JobVertex{
		ID:             v.ID,
		Name:           v.Name,
		MaxParallelism: v.MaxParallelism,
		Parallelism:    v.Parallelism,
		Status:         v.Status,
		StartTime:      i64(v.StartTime),
		EndTime:        i64(v.EndTime),
		Duration:       i64(v.Duration),
		Tasks:          tasks,
		Metrics:        mapVertexMetrics(&v.Metrics),
	}
}

// mapVertexMetrics converts Flink VertexMetrics to GraphQL VertexMetrics.
func mapVertexMetrics(m *flink.VertexMetrics) *model.VertexMetrics {
	return &model.VertexMetrics{
		ReadBytes:                f64(m.ReadBytes),
		ReadBytesComplete:        m.ReadBytesComplete,
		WriteBytes:               f64(m.WriteBytes),
		WriteBytesComplete:       m.WriteBytesComplete,
		ReadRecords:              f64(m.ReadRecords),
		ReadRecordsComplete:      m.ReadRecordsComplete,
		WriteRecords:             f64(m.WriteRecords),
		WriteRecordsComplete:     m.WriteRecordsComplete,
		AccumulatedBackpressured: f64(m.AccumulatedBackpressured.Float64()),
		AccumulatedIdle:          f64(m.AccumulatedIdle.Float64()),
		AccumulatedBusy:          f64(m.AccumulatedBusy.Float64()),
	}
}

// mapVertexDetail converts a Flink VertexDetail to a GraphQL VertexDetail.
func mapVertexDetail(vid string, vd *flink.VertexDetail) *model.VertexDetail {
	subtasks := make([]*model.SubtaskInfo, len(vd.Subtasks))
	for i, s := range vd.Subtasks {
		subtasks[i] = &model.SubtaskInfo{
			Subtask:       s.Subtask,
			Status:        s.Status,
			Attempt:       s.Attempt,
			Endpoint:      s.Endpoint,
			StartTime:     i64(s.StartTime),
			EndTime:       i64(s.EndTime),
			Duration:      i64(s.Duration),
			Metrics:       mapVertexMetrics(&s.Metrics),
			TaskManagerID: s.TaskManagerID,
		}
	}
	return &model.VertexDetail{
		ID:          vid,
		Name:        vd.Name,
		Parallelism: vd.Parallelism,
		Now:         i64(vd.Now),
		Subtasks:    subtasks,
	}
}

// mapCheckpointStats converts Flink CheckpointStats to GraphQL CheckpointStats.
func mapCheckpointStats(cp *flink.CheckpointStats) *model.CheckpointStats {
	history := make([]*model.CheckpointHistoryEntry, len(cp.History))
	for i, h := range cp.History {
		history[i] = mapCheckpointHistoryEntry(&h)
	}

	result := &model.CheckpointStats{
		Counts: &model.CheckpointCounts{
			Completed:  cp.Counts.Completed,
			InProgress: cp.Counts.InProgress,
			Failed:     cp.Counts.Failed,
			Total:      cp.Counts.Total,
			Restored:   cp.Counts.Restored,
		},
		History: history,
	}

	if cp.Summary != nil {
		result.Summary = &model.CheckpointSummary{
			StateSize:        mapMinMaxAvg(cp.Summary.StateSize),
			EndToEndDuration: mapMinMaxAvg(cp.Summary.EndToEndDuration),
			CheckpointedSize: mapMinMaxAvg(cp.Summary.CheckpointedSize),
			ProcessedData:    mapMinMaxAvg(cp.Summary.ProcessedData),
			PersistedData:    mapMinMaxAvg(cp.Summary.PersistedData),
		}
	}

	if cp.Latest != nil {
		result.Latest = &model.CheckpointLatest{}
		if cp.Latest.Completed != nil {
			result.Latest.Completed = mapCheckpointHistoryEntry(cp.Latest.Completed)
		}
		if cp.Latest.Failed != nil {
			result.Latest.Failed = mapCheckpointHistoryEntry(cp.Latest.Failed)
		}
		if cp.Latest.Savepoint != nil {
			result.Latest.Savepoint = mapCheckpointHistoryEntry(cp.Latest.Savepoint)
		}
		if cp.Latest.Restored != nil {
			r := cp.Latest.Restored
			result.Latest.Restored = &model.CheckpointRestoredInfo{
				ID:               i64(r.ID),
				RestoreTimestamp: i64(r.RestoreTimestamp),
				IsSavepoint:      r.IsSavepoint,
				ExternalPath:     r.ExternalPath,
			}
		}
	}

	return result
}

func mapCheckpointHistoryEntry(h *flink.CheckpointHistoryEntry) *model.CheckpointHistoryEntry {
	return &model.CheckpointHistoryEntry{
		ID:                      i64(h.ID),
		Status:                  h.Status,
		IsSavepoint:             h.IsSavepoint,
		TriggerTimestamp:        i64(h.TriggerTimestamp),
		LatestAckTimestamp:      i64(h.LatestAckTimestamp),
		StateSize:               i64(h.StateSize),
		EndToEndDuration:        i64(h.EndToEndDuration),
		ProcessedData:           i64(h.ProcessedData),
		PersistedData:           i64(h.PersistedData),
		NumSubtasks:             h.NumSubtasks,
		NumAcknowledgedSubtasks: h.NumAcknowledgedSubtask,
		CheckpointedSize:        i64p(h.CheckpointedSize),
	}
}

func mapMinMaxAvg(v *flink.CheckpointMinMaxAvg) *model.CheckpointMinMaxAvg {
	if v == nil {
		return nil
	}
	return &model.CheckpointMinMaxAvg{
		Min: i64(v.Min),
		Max: i64(v.Max),
		Avg: i64(v.Avg),
	}
}

// mapFlamegraphNode recursively converts a Flink FlamegraphNode to GraphQL.
func mapFlamegraphNode(n *flink.FlamegraphNode) *model.FlamegraphNode {
	var children []*model.FlamegraphNode
	for i := range n.Children {
		children = append(children, mapFlamegraphNode(&n.Children[i]))
	}
	return &model.FlamegraphNode{
		Name:     n.Name,
		Value:    i64(n.Value),
		Children: children,
	}
}

// mapTMItem converts a Flink TaskManagerItem to GraphQL TaskManagerOverview.
func mapTMItem(tm *flink.TaskManagerItem) *model.TaskManagerOverview {
	return &model.TaskManagerOverview{
		ID:                     tm.ID,
		Path:                   tm.Path,
		DataPort:               tm.DataPort,
		JmxPort:                tm.JMXPort,
		TimeSinceLastHeartbeat: i64(tm.TimeSinceLastHeartbeat),
		SlotsNumber:            tm.SlotsNumber,
		FreeSlots:              tm.FreeSlots,
		TotalResource:          mapResourceProfile(&tm.TotalResource),
		FreeResource:           mapResourceProfile(&tm.FreeResource),
		Hardware:               mapHardware(&tm.Hardware),
		MemoryConfiguration:    mapTMMemory(&tm.MemoryConfiguration),
	}
}

func mapResourceProfile(rp *flink.TaskManagerResourceProfile) *model.TaskManagerResourceProfile {
	return &model.TaskManagerResourceProfile{
		CPUCores:          rp.CPUCores,
		TaskHeapMemory:    i64(rp.TaskHeapMemory),
		TaskOffHeapMemory: i64(rp.TaskOffHeap),
		ManagedMemory:     i64(rp.ManagedMemory),
		NetworkMemory:     i64(rp.NetworkMemory),
	}
}

func mapHardware(hw *flink.TaskManagerHardware) *model.TaskManagerHardware {
	return &model.TaskManagerHardware{
		CPUCores:       hw.CPUCores,
		PhysicalMemory: i64(hw.PhysicalMemory),
		FreeMemory:     i64(hw.FreeMemory),
		ManagedMemory:  i64(hw.ManagedMemory),
	}
}

func mapTMMemory(m *flink.TaskManagerMemory) *model.TaskManagerMemory {
	return &model.TaskManagerMemory{
		FrameworkHeap:      i64(m.FrameworkHeap),
		TaskHeap:           i64(m.TaskHeap),
		FrameworkOffHeap:   i64(m.FrameworkOffHeap),
		TaskOffHeap:        i64(m.TaskOffHeap),
		NetworkMemory:      i64(m.NetworkMemory),
		ManagedMemory:      i64(m.ManagedMemory),
		JvmMetaspace:       i64(m.JVMMetaspace),
		JvmOverhead:        i64(m.JVMOverhead),
		TotalFlinkMemory:   i64(m.TotalFlinkMemory),
		TotalProcessMemory: i64(m.TotalProcessMemory),
	}
}

func mapMetrics(metrics []flink.MetricItem) []*model.MetricEntry {
	result := make([]*model.MetricEntry, len(metrics))
	for i, m := range metrics {
		result[i] = &model.MetricEntry{ID: m.ID, Value: m.Value}
	}
	return result
}

// mapSQLRow converts a flink.SQLGatewayRow to []string for GraphQL.
func mapSQLRow(row *flink.SQLGatewayRow) []*string {
	result := make([]*string, len(row.Fields))
	for i, f := range row.Fields {
		s := fmt.Sprintf("%v", f)
		result[i] = &s
	}
	return result
}

// mapConnectorRefs converts detected ConnectorRefs to GraphQL JobConnector models.
// It also attaches per-vertex I/O metrics when available.
func mapConnectorRefs(refs []connector.ConnectorRef, agg *flink.JobDetailAggregate) []*model.JobConnector {
	if len(refs) == 0 {
		return []*model.JobConnector{}
	}

	// Build vertex metrics index.
	vertexMetrics := make(map[string]*flink.VertexMetrics)
	if agg != nil && agg.Job != nil {
		for i := range agg.Job.Vertices {
			v := &agg.Job.Vertices[i]
			vertexMetrics[v.ID] = &v.Metrics
		}
	}

	result := make([]*model.JobConnector, len(refs))
	for i, ref := range refs {
		jc := &model.JobConnector{
			VertexID:        ref.VertexID,
			VertexName:      ref.VertexName,
			ConnectorType:   string(ref.Type),
			Role:            string(ref.Role),
			Resource:        ref.Resource,
			Confidence:      ref.Confidence,
			DetectionMethod: string(ref.Method),
		}

		if m, ok := vertexMetrics[ref.VertexID]; ok {
			jc.Metrics = &model.ConnectorMetrics{
				RecordsRead:    f64(m.ReadRecords),
				RecordsWritten: f64(m.WriteRecords),
				BytesRead:      f64(m.ReadBytes),
				BytesWritten:   f64(m.WriteBytes),
			}
		}

		result[i] = jc
	}
	return result
}
