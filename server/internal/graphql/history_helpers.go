package graphql

import (
	"encoding/base64"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
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

// flinkJobToHistoryEntry converts a live Flink job overview to a JobHistoryEntry.
func flinkJobToHistoryEntry(j flink.JobOverview, cluster string) *model.JobHistoryEntry {
	entry := &model.JobHistoryEntry{
		Jid:        j.JID,
		Cluster:    cluster,
		Name:       j.Name,
		State:      j.State,
		DurationMs: fmt.Sprintf("%d", j.Duration),
		TasksTotal: j.Tasks.Created + j.Tasks.Scheduled + j.Tasks.Deploying +
			j.Tasks.Running + j.Tasks.Finished + j.Tasks.Canceling +
			j.Tasks.Canceled + j.Tasks.Failed + j.Tasks.Reconciling + j.Tasks.Initializing,
		TasksRunning:  j.Tasks.Running,
		TasksFinished: j.Tasks.Finished,
		TasksCanceled: j.Tasks.Canceled,
		TasksFailed:   j.Tasks.Failed,
		CapturedAt:    time.Now().Format(time.RFC3339),
	}
	if j.StartTime > 0 {
		s := time.UnixMilli(j.StartTime).Format(time.RFC3339)
		entry.StartTime = &s
	}
	if j.EndTime > 0 {
		s := time.UnixMilli(j.EndTime).Format(time.RFC3339)
		entry.EndTime = &s
	}
	return entry
}

// matchesFilter checks whether a live job entry matches the GraphQL filter criteria.
func matchesFilter(e *model.JobHistoryEntry, filter *model.JobHistoryFilter) bool {
	if filter == nil {
		return true
	}
	if filter.ClusterID != nil && *filter.ClusterID != e.Cluster {
		return false
	}
	if filter.State != nil && *filter.State != e.State {
		return false
	}
	if filter.Name != nil && !strings.Contains(strings.ToLower(e.Name), strings.ToLower(*filter.Name)) {
		return false
	}
	// Time filtering for live jobs.
	if e.StartTime != nil {
		st, err := time.Parse(time.RFC3339, *e.StartTime)
		if err == nil {
			if filter.After != nil {
				at, err := time.Parse(time.RFC3339, *filter.After)
				if err == nil && st.Before(at) {
					return false
				}
			}
			if filter.Before != nil {
				bt, err := time.Parse(time.RFC3339, *filter.Before)
				if err == nil && st.After(bt) {
					return false
				}
			}
			// Apply preset timeRange.
			if filter.TimeRange != nil && filter.After == nil && filter.Before == nil {
				cutoff := timeRangeToAfter(*filter.TimeRange)
				if st.Before(cutoff) {
					return false
				}
			}
		}
	}
	return true
}

// timeRangeToAfter converts a TimeRange enum to a cutoff timestamp.
func timeRangeToAfter(tr model.TimeRange) time.Time {
	now := time.Now()
	switch tr {
	case model.TimeRangeLast1h:
		return now.Add(-1 * time.Hour)
	case model.TimeRangeLast2h:
		return now.Add(-2 * time.Hour)
	case model.TimeRangeLast24h:
		return now.Add(-24 * time.Hour)
	case model.TimeRangeLast7d:
		return now.Add(-7 * 24 * time.Hour)
	case model.TimeRangeLast30d:
		return now.Add(-30 * 24 * time.Hour)
	default:
		return now.Add(-24 * time.Hour)
	}
}

// sortJobEntries sorts job history entries by the requested field and direction.
func sortJobEntries(entries []*model.JobHistoryEntry, orderBy *model.OrderByInput) {
	// Default: START_TIME DESC.
	field := model.JobHistoryOrderFieldStartTime
	desc := true
	if orderBy != nil {
		field = orderBy.Field
		desc = orderBy.Direction == model.OrderDirectionDesc
	}

	sort.SliceStable(entries, func(i, j int) bool {
		var less bool
		switch field {
		case model.JobHistoryOrderFieldStartTime:
			less = compareOptionalTime(entries[i].StartTime, entries[j].StartTime)
		case model.JobHistoryOrderFieldEndTime:
			less = compareOptionalTime(entries[i].EndTime, entries[j].EndTime)
		case model.JobHistoryOrderFieldDuration:
			di, _ := strconv.ParseInt(entries[i].DurationMs, 10, 64)
			dj, _ := strconv.ParseInt(entries[j].DurationMs, 10, 64)
			less = di < dj
		case model.JobHistoryOrderFieldName:
			less = strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
		case model.JobHistoryOrderFieldState:
			less = entries[i].State < entries[j].State
		default:
			less = compareOptionalTime(entries[i].StartTime, entries[j].StartTime)
		}
		if desc {
			return !less
		}
		return less
	})
}

// compareOptionalTime compares two optional RFC3339 timestamps. Nil is sorted last.
func compareOptionalTime(a, b *string) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil {
		return false // nil sorts after non-nil
	}
	if b == nil {
		return true
	}
	ta, _ := time.Parse(time.RFC3339, *a)
	tb, _ := time.Parse(time.RFC3339, *b)
	return ta.Before(tb)
}

// buildEntryCursor creates an opaque cursor for a unified result entry using its index.
func buildEntryCursor(e *model.JobHistoryEntry, idx int) string {
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%d|%s|%s", idx, e.Cluster, e.Jid)))
}

// findCursorIndex finds the index of the entry matching the given cursor.
// Returns -1 if not found (which means pagination starts at 0).
func findCursorIndex(entries []*model.JobHistoryEntry, cursor string) int {
	b, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return -1
	}
	parts := strings.SplitN(string(b), "|", 3)
	if len(parts) != 3 {
		return -1
	}
	idx, err := strconv.Atoi(parts[0])
	if err != nil || idx < 0 || idx >= len(entries) {
		return -1
	}
	// Verify the cursor matches the entry at this index.
	if entries[idx].Cluster == parts[1] && entries[idx].Jid == parts[2] {
		return idx
	}
	// Fallback: search by cluster|jid.
	for i, e := range entries {
		if e.Cluster == parts[1] && e.Jid == parts[2] {
			return i
		}
	}
	return -1
}
