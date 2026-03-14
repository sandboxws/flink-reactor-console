package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// TaskManagerStore provides upsert operations for the task_manager_snapshots table.
type TaskManagerStore struct {
	pool *pgxpool.Pool
}

// UpsertTaskManagers batch-upserts task manager snapshots using the composite PK (id, cluster).
func (s *TaskManagerStore) UpsertTaskManagers(ctx context.Context, snapshots []storage.DBTaskManagerSnapshot) error {
	if len(snapshots) == 0 {
		return nil
	}

	const cols = 14
	args := make([]any, 0, len(snapshots)*cols)
	placeholders := make([]string, 0, len(snapshots))

	for i, tm := range snapshots {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7,
			base+8, base+9, base+10, base+11, base+12, base+13, base+14,
		))
		args = append(args,
			tm.ID, tm.Cluster, tm.Path, tm.DataPort,
			tm.SlotsTotal, tm.SlotsFree, tm.CPUCores,
			tm.PhysicalMemory, tm.FreeMemory, tm.ManagedMemory,
			tm.MemoryConfig, tm.TotalResource, tm.FreeResource, tm.AllocatedSlots,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO task_manager_snapshots (id, cluster, path, data_port,
			slots_total, slots_free, cpu_cores,
			physical_memory, free_memory, managed_memory,
			memory_config, total_resource, free_resource, allocated_slots)
		VALUES %s
		ON CONFLICT (id, cluster) DO UPDATE SET
			path             = EXCLUDED.path,
			data_port        = EXCLUDED.data_port,
			slots_total      = EXCLUDED.slots_total,
			slots_free       = EXCLUDED.slots_free,
			cpu_cores        = EXCLUDED.cpu_cores,
			physical_memory  = EXCLUDED.physical_memory,
			free_memory      = EXCLUDED.free_memory,
			managed_memory   = EXCLUDED.managed_memory,
			memory_config    = EXCLUDED.memory_config,
			total_resource   = EXCLUDED.total_resource,
			free_resource    = EXCLUDED.free_resource,
			allocated_slots  = EXCLUDED.allocated_slots,
			captured_at      = now()
	`, strings.Join(placeholders, ",\n\t\t"))

	_, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("upsert task managers: %w", err)
	}
	return nil
}
