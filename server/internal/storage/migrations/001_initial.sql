-- +goose Up
-- Creates all tables for the FlinkReactor historical data store.

-- Clusters: one row per monitored Flink cluster.
CREATE TABLE IF NOT EXISTS clusters (
    name        TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jobs: historical record of every job seen.
CREATE TABLE IF NOT EXISTS jobs (
    jid             TEXT NOT NULL,
    cluster         TEXT NOT NULL REFERENCES clusters(name) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    state           TEXT NOT NULL,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    duration_ms     BIGINT,
    last_modified   TIMESTAMPTZ,
    tasks_total     INT NOT NULL DEFAULT 0,
    tasks_running   INT NOT NULL DEFAULT 0,
    tasks_finished  INT NOT NULL DEFAULT 0,
    tasks_canceled  INT NOT NULL DEFAULT 0,
    tasks_failed    INT NOT NULL DEFAULT 0,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (jid, cluster)
);

CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs (state);
CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs (name);
CREATE INDEX IF NOT EXISTS idx_jobs_start_time ON jobs (start_time);

-- Vertices: per-job vertex snapshots.
CREATE TABLE IF NOT EXISTS vertices (
    id              TEXT NOT NULL,
    jid             TEXT NOT NULL,
    cluster         TEXT NOT NULL,
    name            TEXT NOT NULL,
    parallelism     INT NOT NULL DEFAULT 0,
    max_parallelism INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    duration_ms     BIGINT,
    read_bytes      DOUBLE PRECISION,
    write_bytes     DOUBLE PRECISION,
    read_records    DOUBLE PRECISION,
    write_records   DOUBLE PRECISION,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, jid, cluster),
    FOREIGN KEY (jid, cluster) REFERENCES jobs(jid, cluster) ON DELETE CASCADE
);

-- Checkpoints: per-job checkpoint history.
CREATE TABLE IF NOT EXISTS checkpoints (
    checkpoint_id       BIGINT NOT NULL,
    jid                 TEXT NOT NULL,
    cluster             TEXT NOT NULL,
    status              TEXT NOT NULL,
    is_savepoint        BOOLEAN NOT NULL DEFAULT false,
    trigger_timestamp   TIMESTAMPTZ,
    latest_ack          TIMESTAMPTZ,
    state_size          BIGINT,
    end_to_end_duration BIGINT,
    processed_data      BIGINT,
    persisted_data      BIGINT,
    num_subtasks        INT,
    num_ack_subtasks    INT,
    checkpointed_size   BIGINT,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (checkpoint_id, jid, cluster),
    FOREIGN KEY (jid, cluster) REFERENCES jobs(jid, cluster) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_trigger ON checkpoints (trigger_timestamp);

-- Exceptions: per-job exception history.
CREATE TABLE IF NOT EXISTS exceptions (
    id              BIGSERIAL PRIMARY KEY,
    jid             TEXT NOT NULL,
    cluster         TEXT NOT NULL,
    exception_name  TEXT NOT NULL,
    stacktrace      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL,
    task_name       TEXT,
    endpoint        TEXT,
    task_manager_id TEXT,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (jid, cluster) REFERENCES jobs(jid, cluster) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exceptions_job ON exceptions (jid, cluster);
CREATE INDEX IF NOT EXISTS idx_exceptions_time ON exceptions (timestamp);
CREATE INDEX IF NOT EXISTS idx_exceptions_dedup ON exceptions (jid, cluster, exception_name, timestamp);

-- Task manager snapshots: periodic snapshots of task manager state.
CREATE TABLE IF NOT EXISTS task_manager_snapshots (
    id                  TEXT NOT NULL,
    cluster             TEXT NOT NULL REFERENCES clusters(name) ON DELETE CASCADE,
    path                TEXT,
    data_port           INT,
    slots_total         INT NOT NULL DEFAULT 0,
    slots_free          INT NOT NULL DEFAULT 0,
    cpu_cores           INT,
    physical_memory     BIGINT,
    free_memory         BIGINT,
    managed_memory      BIGINT,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, cluster, captured_at)
);

-- Job manager snapshots: periodic snapshots of job manager config.
CREATE TABLE IF NOT EXISTS job_manager_snapshots (
    cluster         TEXT NOT NULL REFERENCES clusters(name) ON DELETE CASCADE,
    config_json     JSONB,
    environment_json JSONB,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cluster, captured_at)
);

-- Metrics: time-series metric data, partitioned by month.
CREATE TABLE IF NOT EXISTS metrics (
    id              BIGSERIAL,
    cluster         TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    metric_id       TEXT NOT NULL,
    value           DOUBLE PRECISION,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

CREATE INDEX IF NOT EXISTS idx_metrics_source ON metrics (source_type, source_id, metric_id);
CREATE INDEX IF NOT EXISTS idx_metrics_id ON metrics (metric_id, captured_at);

-- Logs: ingested log lines from Flink task managers and job manager.
CREATE TABLE IF NOT EXISTS logs (
    id              BIGSERIAL PRIMARY KEY,
    cluster         TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    log_file        TEXT NOT NULL,
    content         TEXT,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cluster overview snapshots: periodic captures of /overview data.
CREATE TABLE IF NOT EXISTS cluster_overview_snapshots (
    cluster             TEXT NOT NULL REFERENCES clusters(name) ON DELETE CASCADE,
    flink_version       TEXT,
    slots_total         INT NOT NULL DEFAULT 0,
    slots_available     INT NOT NULL DEFAULT 0,
    jobs_running        INT NOT NULL DEFAULT 0,
    jobs_finished       INT NOT NULL DEFAULT 0,
    jobs_cancelled      INT NOT NULL DEFAULT 0,
    jobs_failed         INT NOT NULL DEFAULT 0,
    task_managers       INT NOT NULL DEFAULT 0,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cluster, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_cluster_overview_time ON cluster_overview_snapshots (captured_at);

-- +goose Down
DROP TABLE IF EXISTS cluster_overview_snapshots;
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS job_manager_snapshots;
DROP TABLE IF EXISTS task_manager_snapshots;
DROP TABLE IF EXISTS exceptions;
DROP TABLE IF EXISTS checkpoints;
DROP TABLE IF EXISTS vertices;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS clusters;
