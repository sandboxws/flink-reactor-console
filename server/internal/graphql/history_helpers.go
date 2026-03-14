package graphql

import (
	"fmt"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
)

// dbJobToHistoryEntry converts a storage.DBJob to a GraphQL JobHistoryEntry.
func dbJobToHistoryEntry(j storage.DBJob) *model.JobHistoryEntry {
	entry := &model.JobHistoryEntry{
		Jid:           j.JID,
		Cluster:       j.Cluster,
		Name:          j.Name,
		State:         j.State,
		DurationMs:    fmt.Sprintf("%d", j.DurationMs),
		TasksTotal:    j.TasksTotal,
		TasksRunning:  j.TasksRunning,
		TasksFinished: j.TasksFinished,
		TasksCanceled: j.TasksCanceled,
		TasksFailed:   j.TasksFailed,
		CapturedAt:    j.CapturedAt.Format(time.RFC3339),
	}
	if j.StartTime != nil {
		s := j.StartTime.Format(time.RFC3339)
		entry.StartTime = &s
	}
	if j.EndTime != nil {
		s := j.EndTime.Format(time.RFC3339)
		entry.EndTime = &s
	}
	return entry
}

// buildJobCursor creates an opaque cursor from a DBJob for pagination.
func buildJobCursor(j storage.DBJob) string {
	return store.EncodeCursor(j.StartTime, j.JID)
}

// dbCheckpointToStoredCheckpoint converts a storage.DBCheckpoint to a GraphQL StoredCheckpoint.
func dbCheckpointToStoredCheckpoint(c storage.DBCheckpoint) *model.StoredCheckpoint {
	entry := &model.StoredCheckpoint{
		CheckpointID:     fmt.Sprintf("%d", c.CheckpointID),
		Jid:              c.JID,
		Cluster:          c.Cluster,
		Status:           c.Status,
		IsSavepoint:      c.IsSavepoint,
		StateSize:        fmt.Sprintf("%d", c.StateSize),
		EndToEndDuration: fmt.Sprintf("%d", c.EndToEndDuration),
		ProcessedData:    fmt.Sprintf("%d", c.ProcessedData),
		PersistedData:    fmt.Sprintf("%d", c.PersistedData),
		NumSubtasks:      c.NumSubtasks,
		NumAckSubtasks:   c.NumAckSubtasks,
		CapturedAt:       c.CapturedAt.Format(time.RFC3339),
	}
	if c.TriggerTimestamp != nil {
		s := c.TriggerTimestamp.Format(time.RFC3339)
		entry.TriggerTimestamp = &s
	}
	if c.LatestAck != nil {
		s := c.LatestAck.Format(time.RFC3339)
		entry.LatestAck = &s
	}
	if c.CheckpointedSize != nil {
		s := fmt.Sprintf("%d", *c.CheckpointedSize)
		entry.CheckpointedSize = &s
	}
	return entry
}

// dbExceptionToStoredException converts a storage.DBException to a GraphQL StoredException.
func dbExceptionToStoredException(e storage.DBException) *model.StoredException {
	return &model.StoredException{
		ID:            fmt.Sprintf("%d", e.ID),
		Jid:           e.JID,
		Cluster:       e.Cluster,
		ExceptionName: e.ExceptionName,
		Stacktrace:    &e.Stacktrace,
		Timestamp:     e.Timestamp.Format(time.RFC3339),
		TaskName:      e.TaskName,
		Endpoint:      e.Endpoint,
		TaskManagerID: e.TaskManagerID,
		CapturedAt:    e.CapturedAt.Format(time.RFC3339),
	}
}
