package graphql

import (
	"fmt"

	"github.com/sandboxws/flink-reactor/apps/server/internal/connector"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
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
		VertexDetails:    vertexDetails,
		Watermarks:       watermarks,
		BackPressure:     backPressure,
		Accumulators:     accumulators,
	}
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
