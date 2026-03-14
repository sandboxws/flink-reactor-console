-- +goose Up
-- Changes task_manager_snapshots and job_manager_snapshots to upsert-friendly
-- primary keys and adds JSONB columns for rich TM data.

-- Task manager snapshots: switch PK from (id, cluster, captured_at) to (id, cluster)
-- so each task manager has a single row that gets updated on each sync tick.
ALTER TABLE task_manager_snapshots DROP CONSTRAINT task_manager_snapshots_pkey;
ALTER TABLE task_manager_snapshots ADD PRIMARY KEY (id, cluster);

-- Add JSONB columns for structured TM data.
ALTER TABLE task_manager_snapshots
    ADD COLUMN IF NOT EXISTS memory_config   JSONB,
    ADD COLUMN IF NOT EXISTS total_resource   JSONB,
    ADD COLUMN IF NOT EXISTS free_resource    JSONB,
    ADD COLUMN IF NOT EXISTS allocated_slots  JSONB;

-- Job manager snapshots: switch PK from (cluster, captured_at) to (cluster)
-- so each cluster has a single JM row that gets updated on each sync tick.
ALTER TABLE job_manager_snapshots DROP CONSTRAINT job_manager_snapshots_pkey;
ALTER TABLE job_manager_snapshots ADD PRIMARY KEY (cluster);

-- +goose Down
ALTER TABLE job_manager_snapshots DROP CONSTRAINT job_manager_snapshots_pkey;
ALTER TABLE job_manager_snapshots ADD PRIMARY KEY (cluster, captured_at);

ALTER TABLE task_manager_snapshots
    DROP COLUMN IF EXISTS allocated_slots,
    DROP COLUMN IF EXISTS free_resource,
    DROP COLUMN IF EXISTS total_resource,
    DROP COLUMN IF EXISTS memory_config;

ALTER TABLE task_manager_snapshots DROP CONSTRAINT task_manager_snapshots_pkey;
ALTER TABLE task_manager_snapshots ADD PRIMARY KEY (id, cluster, captured_at);
