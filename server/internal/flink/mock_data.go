package flink

import (
	"encoding/base64"
	"fmt"
	"time"
)

// MockClusterOverview returns a realistic ClusterOverview response.
func MockClusterOverview() ClusterOverview {
	return ClusterOverview{
		FlinkVersion:   "1.20.0",
		FlinkCommit:    "abc1234 @ 2024-06-01T00:00:00+00:00",
		SlotsTotal:     16,
		SlotsAvailable: 4,
		JobsRunning:    3,
		JobsFinished:   5,
		JobsCancelled:  1,
		JobsFailed:     1,
		TaskManagers:   4,
	}
}

// MockJobsOverview returns a realistic JobsOverview with multiple job states.
func MockJobsOverview() JobsOverview {
	now := time.Now().UnixMilli()
	return JobsOverview{
		Jobs: []JobOverview{
			{
				JID:              "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
				Name:             "ETL-Orders-Pipeline",
				State:            "RUNNING",
				StartTime:        now - 3_600_000,
				EndTime:          -1,
				Duration:         3_600_000,
				LastModification: now - 3_600_000,
				Tasks: TaskCounts{
					Running:  8,
					Finished: 0,
				},
			},
			{
				JID:              "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d7",
				Name:             "Click-Stream-Analytics",
				State:            "RUNNING",
				StartTime:        now - 7_200_000,
				EndTime:          -1,
				Duration:         7_200_000,
				LastModification: now - 7_200_000,
				Tasks: TaskCounts{
					Running:  4,
					Finished: 0,
				},
			},
			{
				JID:              "b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d8",
				Name:             "User-Session-Aggregation",
				State:            "RUNNING",
				StartTime:        now - 1_800_000,
				EndTime:          -1,
				Duration:         1_800_000,
				LastModification: now - 1_800_000,
				Tasks: TaskCounts{
					Running:  4,
					Finished: 0,
				},
			},
			{
				JID:              "c1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d9",
				Name:             "Daily-Revenue-Report",
				State:            "FINISHED",
				StartTime:        now - 86_400_000,
				EndTime:          now - 82_800_000,
				Duration:         3_600_000,
				LastModification: now - 82_800_000,
				Tasks: TaskCounts{
					Finished: 6,
				},
			},
			{
				JID:              "e1b2c3d4e5f6a7b8c9d0e1f2a3b4c5da",
				Name:             "Legacy-Data-Migration",
				State:            "CANCELED",
				StartTime:        now - 172_800_000,
				EndTime:          now - 169_200_000,
				Duration:         3_600_000,
				LastModification: now - 169_200_000,
				Tasks: TaskCounts{
					Canceled: 4,
				},
			},
			{
				JID:              "f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5db",
				Name:             "Broken-Connector-Test",
				State:            "FAILED",
				StartTime:        now - 259_200_000,
				EndTime:          now - 259_100_000,
				Duration:         100_000,
				LastModification: now - 259_100_000,
				Tasks: TaskCounts{
					Failed: 2,
				},
			},
		},
	}
}

// MockJobDetail returns a realistic JobDetail for the given job ID.
func MockJobDetail(jobID string) JobDetail {
	now := time.Now().UnixMilli()
	vertexIDs := []string{
		"bc764cd8ddf7a0cff126f51c16239658",
		"0a448493b4782967b150582570326227",
		"6d2677a0ecc3fd8df0b72ec675edf8f4",
		"ea632d67b7d595e5b851708ae9ad4571",
	}

	vertices := []Vertex{
		{
			ID: vertexIDs[0], Name: "Source: KafkaSource", MaxParallelism: 16,
			Parallelism: 4, Status: "RUNNING", StartTime: now - 3_600_000, EndTime: -1, Duration: 3_600_000,
			Tasks: map[string]int{
				"RUNNING": 4, "CREATED": 0, "SCHEDULED": 0, "DEPLOYING": 0,
				"FINISHED": 0, "CANCELING": 0, "CANCELED": 0, "FAILED": 0, "RECONCILING": 0, "INITIALIZING": 0,
			},
			Metrics: VertexMetrics{
				ReadBytes: 1_048_576, ReadBytesComplete: true, WriteBytes: 524_288,
				WriteBytesComplete: true, ReadRecords: 100_000, ReadRecordsComplete: true,
				WriteRecords: 100_000, WriteRecordsComplete: true, AccumulatedBusy: 2_400_000,
			},
		},
		{
			ID: vertexIDs[1], Name: "Filter -> Map", MaxParallelism: 16,
			Parallelism: 4, Status: "RUNNING", StartTime: now - 3_599_000, EndTime: -1, Duration: 3_599_000,
			Tasks: map[string]int{
				"RUNNING": 4, "CREATED": 0, "SCHEDULED": 0, "DEPLOYING": 0,
				"FINISHED": 0, "CANCELING": 0, "CANCELED": 0, "FAILED": 0, "RECONCILING": 0, "INITIALIZING": 0,
			},
			Metrics: VertexMetrics{
				ReadBytes: 524_288, ReadBytesComplete: true, WriteBytes: 262_144,
				WriteBytesComplete: true, ReadRecords: 100_000, ReadRecordsComplete: true,
				WriteRecords: 80_000, WriteRecordsComplete: true, AccumulatedBusy: 1_800_000,
			},
		},
		{
			ID: vertexIDs[2], Name: "Aggregate", MaxParallelism: 16,
			Parallelism: 4, Status: "RUNNING", StartTime: now - 3_598_000, EndTime: -1, Duration: 3_598_000,
			Tasks: map[string]int{
				"RUNNING": 4, "CREATED": 0, "SCHEDULED": 0, "DEPLOYING": 0,
				"FINISHED": 0, "CANCELING": 0, "CANCELED": 0, "FAILED": 0, "RECONCILING": 0, "INITIALIZING": 0,
			},
			Metrics: VertexMetrics{
				ReadBytes: 262_144, ReadBytesComplete: true, WriteBytes: 131_072,
				WriteBytesComplete: true, ReadRecords: 80_000, ReadRecordsComplete: true,
				WriteRecords: 40_000, WriteRecordsComplete: true, AccumulatedBusy: 3_000_000,
			},
		},
		{
			ID: vertexIDs[3], Name: "Sink: JdbcSink", MaxParallelism: 16,
			Parallelism: 4, Status: "RUNNING", StartTime: now - 3_597_000, EndTime: -1, Duration: 3_597_000,
			Tasks: map[string]int{
				"RUNNING": 4, "CREATED": 0, "SCHEDULED": 0, "DEPLOYING": 0,
				"FINISHED": 0, "CANCELING": 0, "CANCELED": 0, "FAILED": 0, "RECONCILING": 0, "INITIALIZING": 0,
			},
			Metrics: VertexMetrics{
				ReadBytes: 131_072, ReadBytesComplete: true,
				WriteBytesComplete: true, ReadRecords: 40_000, ReadRecordsComplete: true,
				WriteRecordsComplete: true, AccumulatedBusy: 1_200_000,
			},
		},
	}

	plan := JobPlan{
		JID:  jobID,
		Name: "ETL-Orders-Pipeline",
		Type: "STREAMING",
		Nodes: []PlanNode{
			{ID: vertexIDs[0], Parallelism: 4, Operator: "Source: KafkaSource", OperatorStrategy: "NONE", Description: "Source: KafkaSource"},
			{
				ID: vertexIDs[1], Parallelism: 4, Operator: "Filter -> Map", OperatorStrategy: "NONE", Description: "Filter -> Map",
				Inputs: []PlanNodeInput{{Num: 0, ID: vertexIDs[0], ShipStrategy: "FORWARD", Exchange: "pipelined"}},
			},
			{
				ID: vertexIDs[2], Parallelism: 4, Operator: "Aggregate", OperatorStrategy: "NONE", Description: "Aggregate",
				Inputs: []PlanNodeInput{{Num: 0, ID: vertexIDs[1], ShipStrategy: "HASH", Exchange: "pipelined"}},
			},
			{
				ID: vertexIDs[3], Parallelism: 4, Operator: "Sink: JdbcSink", OperatorStrategy: "NONE", Description: "Sink: JdbcSink",
				Inputs: []PlanNodeInput{{Num: 0, ID: vertexIDs[2], ShipStrategy: "FORWARD", Exchange: "pipelined"}},
			},
		},
	}

	return JobDetail{
		JID:       jobID,
		Name:      "ETL-Orders-Pipeline",
		State:     "RUNNING",
		StartTime: now - 3_600_000,
		EndTime:   -1,
		Duration:  3_600_000,
		Now:       now,
		Timestamps: map[string]int64{
			"RUNNING": now - 3_600_000,
		},
		Vertices:     vertices,
		StatusCounts: map[string]int{"RUNNING": 16},
		Plan:         plan,
	}
}

// MockJobExceptions returns realistic job exceptions for the given job ID.
func MockJobExceptions(_ string) JobExceptions {
	now := time.Now().UnixMilli()
	taskName := stringPtr("Source: KafkaSource (2/4)#0")
	endpoint := stringPtr("taskmanager-0:6121")

	concurrentTaskName := stringPtr("Aggregate (3/4)#0")

	var exc JobExceptions
	exc.ExceptionHistory.Truncated = false
	exc.ExceptionHistory.Entries = []ExceptionHistoryEntry{
		{
			ExceptionName: "org.apache.flink.runtime.JobException",
			Stacktrace:    "org.apache.flink.runtime.JobException: Recovery is suppressed\n\tat org.apache.flink.runtime.executiongraph.failover.flip1.ExecutionFailureHandler.handleFailure(ExecutionFailureHandler.java:138)\n\tat org.apache.flink.runtime.scheduler.DefaultScheduler.handleTaskFailure(DefaultScheduler.java:252)\nCaused by: java.lang.RuntimeException: Serialization error\n\tat org.apache.flink.api.common.typeutils.TypeSerializer.serialize(TypeSerializer.java:75)",
			Timestamp:     now - 120_000,
			TaskName:      taskName,
			Endpoint:      endpoint,
			TaskManagerID: nil,
			// FLIP-304 enricher classification: this is a user-code fault.
			FailureLabels: map[string]string{"type": "USER"},
			// A second subtask failed at the same time under a different cause.
			ConcurrentExceptions: []ExceptionHistoryEntry{
				{
					ExceptionName: "java.lang.OutOfMemoryError",
					Stacktrace:    "java.lang.OutOfMemoryError: Java heap space\n\tat org.apache.flink.table.runtime.operators.aggregate.GroupAggFunction.processElement(GroupAggFunction.java:162)",
					Timestamp:     now - 120_000,
					TaskName:      concurrentTaskName,
					Endpoint:      endpoint,
					TaskManagerID: nil,
					FailureLabels: map[string]string{"type": "SYSTEM"},
				},
			},
		},
	}
	return exc
}

// MockCheckpointStats returns realistic checkpoint statistics for the given job ID.
func MockCheckpointStats(_ string) CheckpointStats {
	now := time.Now().UnixMilli()
	checkpointType := "CHECKPOINT"
	history := make([]CheckpointHistoryEntry, 10)
	for i := range history {
		stateSize := int64(500_000 + i*100_000)
		checkpointedSize := stateSize * 6 / 10
		status := "COMPLETED"
		if i == 7 {
			status = "FAILED"
		}
		history[i] = CheckpointHistoryEntry{
			ID:                     int64(i + 1),
			Status:                 status,
			IsSavepoint:            false,
			CheckpointType:         &checkpointType,
			TriggerTimestamp:       now - int64((10-i)*60_000),
			LatestAckTimestamp:     now - int64((10-i)*60_000) + 2000,
			StateSize:              stateSize,
			EndToEndDuration:       2000,
			ProcessedData:          int64(100_000 + i*50_000),
			PersistedData:          stateSize,
			NumSubtasks:            16,
			NumAcknowledgedSubtask: 16,
			CheckpointedSize:       &checkpointedSize,
		}
		if status == "COMPLETED" {
			path := fmt.Sprintf("s3://flink/checkpoints/mock/chk-%d", i+1)
			discarded := false
			history[i].ExternalPath = &path
			history[i].Discarded = &discarded
		} else {
			msg := "Checkpoint expired before completing. Checkpoint timeout: 600000ms"
			failedAt := now - int64((10-i)*60_000) + 600_000
			history[i].FailureMessage = &msg
			history[i].FailureTimestamp = &failedAt
		}
	}

	latestCompleted := history[9]
	latestFailed := history[7]
	restoredPath := "s3://flink/checkpoints/mock/chk-1"

	return CheckpointStats{
		Counts: CheckpointCounts{
			Completed:  9,
			InProgress: 0,
			Failed:     1,
			Total:      10,
			Restored:   1,
		},
		History: history,
		Summary: &CheckpointSummary{
			StateSize:        &CheckpointMinMaxAvg{Min: 500_000, Max: 1_400_000, Avg: 950_000},
			EndToEndDuration: &CheckpointMinMaxAvg{Min: 1500, Max: 3000, Avg: 2000},
			CheckpointedSize: &CheckpointMinMaxAvg{Min: 300_000, Max: 840_000, Avg: 570_000},
		},
		Latest: &CheckpointLatest{
			Completed: &latestCompleted,
			Failed:    &latestFailed,
			Restored: &CheckpointRestoredInfo{
				ID:               1,
				RestoreTimestamp: now - 600_000,
				IsSavepoint:      false,
				ExternalPath:     &restoredPath,
			},
		},
	}
}

// MockTaskManagers returns a realistic TaskManagerList.
func MockTaskManagers() TaskManagerList {
	now := time.Now().UnixMilli()
	tms := make([]TaskManagerItem, 4)
	for i := range tms {
		tms[i] = TaskManagerItem{
			ID:                     fmt.Sprintf("tm-%032x", i+1),
			Path:                   fmt.Sprintf("taskmanager-%d:6121", i),
			DataPort:               6121,
			JMXPort:                8789,
			TimeSinceLastHeartbeat: now - int64(i*1000),
			SlotsNumber:            4,
			FreeSlots:              1,
			TotalResource: TaskManagerResourceProfile{
				CPUCores: 4.0, TaskHeapMemory: 1_073_741_824, TaskOffHeap: 0,
				ManagedMemory: 536_870_912, NetworkMemory: 134_217_728,
			},
			FreeResource: TaskManagerResourceProfile{
				CPUCores: 1.0, TaskHeapMemory: 268_435_456, TaskOffHeap: 0,
				ManagedMemory: 134_217_728, NetworkMemory: 33_554_432,
			},
			Hardware: TaskManagerHardware{
				CPUCores: 8, PhysicalMemory: 17_179_869_184, FreeMemory: 4_294_967_296,
				ManagedMemory: 536_870_912,
			},
			MemoryConfiguration: TaskManagerMemory{
				FrameworkHeap: 134_217_728, TaskHeap: 1_073_741_824,
				FrameworkOffHeap: 134_217_728, TaskOffHeap: 0,
				NetworkMemory: 134_217_728, ManagedMemory: 536_870_912,
				JVMMetaspace: 268_435_456, JVMOverhead: 201_326_592,
				TotalFlinkMemory: 2_013_265_920, TotalProcessMemory: 2_483_027_968,
			},
			AllocatedSlots: []AllocatedSlot{},
		}
	}
	return TaskManagerList{TaskManagers: tms}
}

// MockTaskManagerDetail returns a realistic TaskManagerDetail for the given TM ID.
func MockTaskManagerDetail(tmID string) TaskManagerItem {
	tms := MockTaskManagers()
	for _, tm := range tms.TaskManagers {
		if tm.ID == tmID {
			return tm
		}
	}
	return tms.TaskManagers[0]
}

// MockJMConfig returns a realistic JM config response.
func MockJMConfig() JMConfig {
	return JMConfig{
		{Key: "jobmanager.rpc.address", Value: "jobmanager"},
		{Key: "jobmanager.rpc.port", Value: "6123"},
		{Key: "jobmanager.memory.process.size", Value: "1600m"},
		{Key: "taskmanager.memory.process.size", Value: "2400m"},
		{Key: "taskmanager.numberOfTaskSlots", Value: "4"},
		{Key: "parallelism.default", Value: "4"},
		{Key: "state.backend.type", Value: "rocksdb"},
		{Key: "state.checkpoints.dir", Value: "hdfs:///flink/checkpoints"},
		{Key: "state.savepoints.dir", Value: "hdfs:///flink/savepoints"},
		{Key: "execution.checkpointing.interval", Value: "60s"},
	}
}

// MockJMEnvironment returns a realistic JM environment response.
func MockJMEnvironment() JMEnvironment {
	return JMEnvironment{
		JVM: JMEnvironmentJVM{
			Version: "17.0.9+9",
			Arch:    "amd64",
			Options: []string{
				"-Xmx1024m",
				"-Xms1024m",
				"-XX:+UseG1GC",
				"-XX:MaxGCPauseMillis=100",
			},
		},
		Classpath: []string{
			"/opt/flink/lib/flink-dist-1.20.0.jar",
			"/opt/flink/lib/log4j-api-2.17.2.jar",
			"/opt/flink/lib/log4j-core-2.17.2.jar",
		},
		SystemProperties: map[string]string{
			"java.version":  "17.0.9",
			"os.name":       "Linux",
			"os.arch":       "amd64",
			"user.dir":      "/opt/flink",
			"file.encoding": "UTF-8",
		},
	}
}

// MockJarList returns a realistic JarList response.
func MockJarList() JarList {
	now := time.Now().UnixMilli()
	return JarList{
		Address: "http://localhost:8081",
		Files: []JarEntry{
			{
				ID:       "7a9e2a10-6e66-4b3e-a7de-3b84e9e1c2f5_WordCount.jar",
				Name:     "WordCount.jar",
				Uploaded: now - 3_600_000,
				Entry: []JarEntryPoint{
					{Name: "org.apache.flink.examples.java.wordcount.WordCount", Description: nil},
				},
			},
			{
				ID:       "c3f2b1a0-8d44-4e2a-b5c1-9f8e7d6c5b4a_TopSpeedWindowing.jar",
				Name:     "TopSpeedWindowing.jar",
				Uploaded: now - 7_200_000,
				Entry: []JarEntryPoint{
					{Name: "org.apache.flink.streaming.examples.windowing.TopSpeedWindowing", Description: nil},
				},
			},
		},
	}
}

// MockCheckpointConfig returns a realistic checkpoint config response.
func MockCheckpointConfig() CheckpointConfig {
	stateBackend := "HashMapStateBackend"
	checkpointStorage := "FileSystemCheckpointStorage"
	tolerable := 0
	alignedTimeout := int64(0)
	afterTasksFinish := true
	return CheckpointConfig{
		Mode:          "EXACTLY_ONCE",
		Interval:      60000,
		Timeout:       600000,
		MinPause:      1000,
		MaxConcurrent: 1,
		Externalization: struct {
			Enabled              bool `json:"enabled"`
			DeleteOnCancellation bool `json:"delete_on_cancellation"`
		}{
			Enabled:              true,
			DeleteOnCancellation: false,
		},
		UnalignedCheckpoints:        false,
		StateBackend:                &stateBackend,
		CheckpointStorage:           &checkpointStorage,
		TolerableFailedCheckpoints:  &tolerable,
		AlignedCheckpointTimeout:    &alignedTimeout,
		CheckpointsAfterTasksFinish: &afterTasksFinish,
	}
}

// MockCheckpointDetail returns a realistic checkpoint detail response.
// Checkpoint 8 mirrors the FAILED entry in MockCheckpointStats; every other
// ID is a completed, externally addressable checkpoint.
func MockCheckpointDetail(cpID int64) CheckpointDetail {
	now := time.Now().UnixMilli()
	checkpointType := "CHECKPOINT"
	stateSize := int64(1_200_000)
	checkpointedSize := int64(720_000)
	processed := int64(400_000)
	persisted := stateSize

	detail := CheckpointDetail{
		ID:                     cpID,
		Status:                 "COMPLETED",
		IsSavepoint:            false,
		CheckpointType:         &checkpointType,
		TriggerTimestamp:       now - 120_000,
		LatestAckTimestamp:     now - 118_000,
		StateSize:              stateSize,
		EndToEndDuration:       2000,
		NumSubtasks:            16,
		NumAcknowledgedSubtask: 16,
		CheckpointedSize:       &checkpointedSize,
		ProcessedData:          &processed,
		PersistedData:          &persisted,
		Tasks: map[string]CheckpointTaskStats{
			"vertex-source-1": {
				ID:                     cpID,
				Status:                 "COMPLETED",
				LatestAckTimestamp:     now - 119_000,
				StateSize:              800_000,
				EndToEndDuration:       1500,
				NumSubtasks:            8,
				NumAcknowledgedSubtask: 8,
				CheckpointedSize:       &checkpointedSize,
				ProcessedData:          &processed,
				PersistedData:          &persisted,
			},
			"vertex-sink-2": {
				ID:                     cpID,
				Status:                 "COMPLETED",
				LatestAckTimestamp:     now - 118_000,
				StateSize:              400_000,
				EndToEndDuration:       2000,
				NumSubtasks:            8,
				NumAcknowledgedSubtask: 8,
			},
		},
	}

	if cpID == 8 {
		msg := "Checkpoint expired before completing. Checkpoint timeout: 600000ms"
		failedAt := now - 60_000
		detail.Status = "FAILED"
		detail.FailureMessage = &msg
		detail.FailureTimestamp = &failedAt
		detail.NumAcknowledgedSubtask = 11
	} else {
		path := fmt.Sprintf("s3://flink/checkpoints/mock/chk-%d", cpID)
		discarded := false
		detail.ExternalPath = &path
		detail.Discarded = &discarded
	}

	return detail
}

// MockCheckpointSubtasks returns realistic per-subtask checkpoint stats for
// one vertex. Subtask 3 is unacknowledged to exercise sparse entries.
func MockCheckpointSubtasks(cpID int64, _ string) CheckpointSubtaskDetail {
	now := time.Now().UnixMilli()
	mma := func(minV, maxV, avgV int64) *CheckpointMinMaxAvg {
		return &CheckpointMinMaxAvg{Min: minV, Max: maxV, Avg: avgV}
	}

	subtasks := make([]CheckpointSubtaskEntry, 4)
	for i := range subtasks {
		if i == 3 {
			subtasks[i] = CheckpointSubtaskEntry{Index: i, Status: "pending_or_failed"}
			continue
		}
		ack := now - 118_000 + int64(i*200)
		e2e := int64(1200 + i*300)
		stateSize := int64(180_000 + i*20_000)
		checkpointed := stateSize * 6 / 10
		startDelay := int64(20 + i*10)
		unaligned := false
		aborted := false
		subtasks[i] = CheckpointSubtaskEntry{
			Index:               i,
			Status:              "completed",
			AckTimestamp:        &ack,
			EndToEndDuration:    &e2e,
			StateSize:           &stateSize,
			CheckpointedSize:    &checkpointed,
			Checkpoint:          &CheckpointSubtaskDuration{Sync: int64(100 + i*50), Async: int64(800 + i*100)},
			Alignment:           &CheckpointSubtaskAlignment{Buffered: 0, Processed: int64(90_000 + i*5_000), Persisted: 0, Duration: int64(40 + i*20)},
			StartDelay:          &startDelay,
			UnalignedCheckpoint: &unaligned,
			Aborted:             &aborted,
		}
	}

	return CheckpointSubtaskDetail{
		CheckpointTaskStats: CheckpointTaskStats{
			ID:                     cpID,
			Status:                 "COMPLETED",
			LatestAckTimestamp:     now - 117_400,
			StateSize:              620_000,
			EndToEndDuration:       2100,
			NumSubtasks:            4,
			NumAcknowledgedSubtask: 3,
		},
		Summary: &CheckpointSubtaskSummary{
			StateSize:        mma(180_000, 220_000, 200_000),
			EndToEndDuration: mma(1200, 1800, 1500),
			CheckpointedSize: mma(108_000, 132_000, 120_000),
			CheckpointDuration: &CheckpointDurationSummary{
				Sync:  mma(100, 200, 150),
				Async: mma(800, 1000, 900),
			},
			Alignment: &CheckpointAlignmentSummary{
				Buffered:  mma(0, 0, 0),
				Processed: mma(90_000, 100_000, 95_000),
				Persisted: mma(0, 0, 0),
				Duration:  mma(40, 80, 60),
			},
			StartDelay: mma(20, 40, 30),
		},
		Subtasks: subtasks,
	}
}

// MockJobConfig returns a realistic job config response.
//
// In production, the FlinkReactor DSL (CRD generator + SQL Gateway client) and
// the console SQL Gateway resolver attach SQL via Flink's recognized
// `pipeline.global-job-parameters` mapType config: e.g. submit-time
// `pipeline.global-job-parameters = pipeline.sql.b64:<base64>`. By the time
// `/jobs/:jid/config` returns, Flink has already parsed that mapType into
// `ExecutionConfig.GlobalJobParameters` and surfaces each entry as a flat
// top-level key in the response's `user-config` field. So the mock seeds
// `pipeline.sql.b64` directly — that's the *response* shape the aggregator
// reads and the dashboard's SQL tab decodes for display.
func MockJobConfig(jobID string) JobConfig {
	sql := `CREATE TABLE orders_src (
  id BIGINT,
  customer_id BIGINT,
  amount DECIMAL(10, 2),
  region STRING,
  created_at TIMESTAMP(3),
  WATERMARK FOR created_at AS created_at - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'orders',
  'properties.bootstrap.servers' = 'kafka:9092',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE orders_sink (
  region STRING,
  window_start TIMESTAMP(3),
  total_amount DECIMAL(20, 2),
  order_count BIGINT,
  PRIMARY KEY (region, window_start) NOT ENFORCED
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:postgresql://postgres:5432/analytics',
  'table-name' = 'orders_rollup'
);

INSERT INTO orders_sink
SELECT
  region,
  TUMBLE_START(created_at, INTERVAL '1' MINUTE) AS window_start,
  SUM(amount) AS total_amount,
  COUNT(*) AS order_count
FROM orders_src
WHERE amount > 0
GROUP BY region, TUMBLE(created_at, INTERVAL '1' MINUTE);`
	sqlB64 := base64.StdEncoding.EncodeToString([]byte(sql))
	return JobConfig{
		JID:  jobID,
		Name: "ETL-Orders-Pipeline",
		ExecutionConfig: struct {
			ExecutionMode   string            `json:"execution-mode"`
			RestartStrategy string            `json:"restart-strategy"`
			JobParallelism  int               `json:"job-parallelism"`
			ObjectReuseMode bool              `json:"object-reuse-mode"`
			UserConfig      map[string]string `json:"user-config"`
		}{
			ExecutionMode:   "PIPELINED",
			RestartStrategy: "Cluster level: Fixed Delay with 3 restart(s) and 10000 ms delay",
			JobParallelism:  4,
			ObjectReuseMode: false,
			UserConfig: map[string]string{
				"pipeline.name":    "ETL-Orders-Pipeline",
				"pipeline.sql.b64": sqlB64,
			},
		},
	}
}

// MockVertexDetail returns a realistic vertex detail response.
func MockVertexDetail(vertexID string) VertexDetail {
	now := time.Now().UnixMilli()
	subtasks := make([]SubtaskInfo, 4)
	for i := range subtasks {
		subtasks[i] = SubtaskInfo{
			Subtask:   i,
			Status:    "RUNNING",
			Attempt:   0,
			Endpoint:  fmt.Sprintf("taskmanager-%d:6121", i),
			StartTime: now - 3_600_000,
			EndTime:   -1,
			Duration:  3_600_000,
			Metrics: VertexMetrics{
				ReadBytes: 262_144, ReadBytesComplete: true,
				WriteBytes: 131_072, WriteBytesComplete: true,
				ReadRecords: 25_000, ReadRecordsComplete: true,
				WriteRecords: 25_000, WriteRecordsComplete: true,
				AccumulatedBusy: 600_000,
			},
			TaskManagerID: fmt.Sprintf("tm-%032x", i+1),
		}
	}
	return VertexDetail{
		ID:          vertexID,
		Name:        "Source: KafkaSource",
		Parallelism: 4,
		Now:         now,
		Subtasks:    subtasks,
	}
}

// MockWatermarks returns a realistic watermark response for a vertex.
func MockWatermarks(vertexID string) Watermarks {
	_ = vertexID
	return Watermarks{
		{ID: "0.currentInputWatermark", Value: "1709251200000"},
		{ID: "1.currentInputWatermark", Value: "1709251200000"},
		{ID: "2.currentInputWatermark", Value: "1709251199000"},
		{ID: "3.currentInputWatermark", Value: "1709251200000"},
	}
}

// MockBackPressure returns a realistic backpressure response.
func MockBackPressure() BackPressure {
	return BackPressure{
		Status:            "ok",
		BackpressureLevel: "ok",
		EndTimestamp:      time.Now().UnixMilli(),
		Subtasks: []SubtaskBackPressure{
			{Subtask: 0, AttemptNumber: 0, BackpressureLevel: "ok", Ratio: 0.0, BusyRatio: 0.15, IdleRatio: 0.85},
			{Subtask: 1, AttemptNumber: 0, BackpressureLevel: "ok", Ratio: 0.0, BusyRatio: 0.12, IdleRatio: 0.88},
			{Subtask: 2, AttemptNumber: 0, BackpressureLevel: "ok", Ratio: 0.0, BusyRatio: 0.18, IdleRatio: 0.82},
			{Subtask: 3, AttemptNumber: 0, BackpressureLevel: "ok", Ratio: 0.0, BusyRatio: 0.10, IdleRatio: 0.90},
		},
	}
}

// MockAccumulators returns a realistic accumulators response.
func MockAccumulators(vertexID string) Accumulators {
	return Accumulators{
		ID: vertexID,
		UserAccumulators: []UserAccumulator{
			{Name: "numRecordsIn", Type: "LongCounter", Value: "25000"},
			{Name: "numRecordsOut", Type: "LongCounter", Value: "25000"},
		},
	}
}

// MockTMMetrics returns realistic task manager JVM metrics.
func MockTMMetrics() []MetricItem {
	return []MetricItem{
		{ID: "Status.JVM.CPU.Load", Value: "0.35"},
		{ID: "Status.JVM.Memory.Heap.Used", Value: "536870912"},
		{ID: "Status.JVM.Memory.Heap.Committed", Value: "1073741824"},
		{ID: "Status.JVM.Memory.Heap.Max", Value: "1073741824"},
		{ID: "Status.JVM.Memory.NonHeap.Used", Value: "134217728"},
		{ID: "Status.JVM.Memory.NonHeap.Committed", Value: "201326592"},
		{ID: "Status.JVM.Memory.NonHeap.Max", Value: "-1"},
		{ID: "Status.JVM.Memory.Direct.Count", Value: "42"},
		{ID: "Status.JVM.Memory.Direct.MemoryUsed", Value: "67108864"},
		{ID: "Status.JVM.Memory.Direct.TotalCapacity", Value: "67108864"},
		{ID: "Status.JVM.Memory.Mapped.Count", Value: "0"},
		{ID: "Status.JVM.Memory.Mapped.MemoryUsed", Value: "0"},
		{ID: "Status.JVM.Memory.Mapped.TotalCapacity", Value: "0"},
		{ID: "Status.Shuffle.Netty.AvailableMemory", Value: "100663296"},
		{ID: "Status.Shuffle.Netty.UsedMemory", Value: "33554432"},
		{ID: "Status.Shuffle.Netty.TotalMemory", Value: "134217728"},
		{ID: "Status.Shuffle.Netty.AvailableMemorySegments", Value: "3072"},
		{ID: "Status.Shuffle.Netty.UsedMemorySegments", Value: "1024"},
		{ID: "Status.Shuffle.Netty.TotalMemorySegments", Value: "4096"},
		{ID: "Status.Flink.Memory.Managed.Used", Value: "268435456"},
		{ID: "Status.Flink.Memory.Managed.Total", Value: "536870912"},
		{ID: "Status.JVM.Memory.Metaspace.Used", Value: "67108864"},
		{ID: "Status.JVM.Memory.Metaspace.Max", Value: "268435456"},
		{ID: "Status.JVM.Threads.Count", Value: "128"},
		{ID: "Status.JVM.GarbageCollector.G1_Young_Generation.Count", Value: "245"},
		{ID: "Status.JVM.GarbageCollector.G1_Young_Generation.Time", Value: "4500"},
		{ID: "Status.JVM.GarbageCollector.G1_Old_Generation.Count", Value: "3"},
		{ID: "Status.JVM.GarbageCollector.G1_Old_Generation.Time", Value: "1200"},
	}
}

// MockJMMetrics returns realistic job manager JVM metrics.
func MockJMMetrics() []MetricItem {
	return []MetricItem{
		{ID: "Status.JVM.Memory.Heap.Used", Value: "268435456"},
		{ID: "Status.JVM.Memory.Heap.Max", Value: "1073741824"},
		{ID: "Status.JVM.Memory.NonHeap.Used", Value: "100663296"},
		{ID: "Status.JVM.Memory.NonHeap.Max", Value: "-1"},
		{ID: "Status.JVM.Memory.Metaspace.Used", Value: "50331648"},
		{ID: "Status.JVM.Memory.Metaspace.Max", Value: "268435456"},
		{ID: "Status.JVM.Memory.Direct.MemoryUsed", Value: "33554432"},
		{ID: "Status.JVM.Memory.Direct.TotalCapacity", Value: "33554432"},
		{ID: "Status.JVM.Threads.Count", Value: "64"},
		{ID: "Status.JVM.GarbageCollector.G1_Young_Generation.Count", Value: "120"},
		{ID: "Status.JVM.GarbageCollector.G1_Young_Generation.Time", Value: "2100"},
		{ID: "Status.JVM.GarbageCollector.G1_Old_Generation.Count", Value: "1"},
		{ID: "Status.JVM.GarbageCollector.G1_Old_Generation.Time", Value: "500"},
	}
}

// MockThreadDump returns a realistic Flink thread-dump response. The JobManager
// and TaskManager thread-dump endpoints share an identical payload shape, so
// both mock routes serve this fixture.
func MockThreadDump() TMThreadDump {
	return TMThreadDump{
		ThreadInfos: []TMThreadDumpEntry{
			{
				ThreadName: "main",
				StringifiedThreadInfo: "\"main\" #1 prio=5 os_prio=0 nid=0x1 waiting on condition\n" +
					"   java.lang.Thread.State: WAITING (parking)\n" +
					"\tat jdk.internal.misc.Unsafe.park(Native Method)",
			},
			{
				ThreadName: "flink-pekko.actor.default-dispatcher-3",
				StringifiedThreadInfo: "\"flink-pekko.actor.default-dispatcher-3\" #42 daemon prio=5 os_prio=0 nid=0x2a runnable\n" +
					"   java.lang.Thread.State: RUNNABLE\n" +
					"\tat sun.nio.ch.EPoll.wait(Native Method)",
			},
		},
	}
}

// MockClusterConfig returns a realistic Flink cluster config response.
func MockClusterConfig() ClusterConfig {
	return ClusterConfig{
		RefreshInterval: 3000,
		TimezoneName:    "UTC",
		TimezoneOffset:  0,
		FlinkVersion:    "1.20.0",
		FlinkRevision:   "abc1234",
		Features: struct {
			WebSubmit  bool `json:"web-submit"`
			WebCancel  bool `json:"web-cancel"`
			WebRescale bool `json:"web-rescale"`
			WebHistory bool `json:"web-history"`
		}{
			WebSubmit:  true,
			WebCancel:  true,
			WebRescale: false,
			WebHistory: true,
		},
	}
}

func stringPtr(s string) *string {
	return &s
}
