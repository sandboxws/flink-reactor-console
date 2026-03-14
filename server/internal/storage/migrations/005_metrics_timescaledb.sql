-- +goose Up
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Drop existing partitions and convert to hypertable.
-- TimescaleDB requires the table to have no child tables (partitions).
-- Strategy: create new hypertable, migrate data, swap.

CREATE TABLE metrics_new (
    captured_at     TIMESTAMPTZ NOT NULL,
    cluster         TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    metric_id       TEXT NOT NULL,
    value           DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('metrics_new', 'captured_at',
    chunk_time_interval => INTERVAL '1 day');

-- Migrate existing data
INSERT INTO metrics_new (captured_at, cluster, source_type, source_id, metric_id, value)
SELECT captured_at, cluster, source_type, source_id, metric_id, value
FROM metrics;

-- Swap tables
DROP TABLE metrics CASCADE;
ALTER TABLE metrics_new RENAME TO metrics;

-- Indexes for query patterns
CREATE INDEX idx_metrics_source ON metrics (cluster, source_type, source_id, metric_id, captured_at DESC);
CREATE INDEX idx_metrics_catalog ON metrics (cluster, captured_at DESC, source_type, source_id, metric_id);

-- Compression policy: compress chunks older than 2 days
ALTER TABLE metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'cluster, source_type, source_id, metric_id',
    timescaledb.compress_orderby = 'captured_at DESC'
);
SELECT add_compression_policy('metrics', INTERVAL '2 days');

-- Retention policy: drop chunks older than 7 days
SELECT add_retention_policy('metrics', INTERVAL '7 days');

-- Continuous aggregate: 1-minute rollups for longer time ranges
CREATE MATERIALIZED VIEW metrics_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', captured_at) AS bucket,
    cluster,
    source_type,
    source_id,
    metric_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    LAST(value, captured_at) AS last_value
FROM metrics
GROUP BY bucket, cluster, source_type, source_id, metric_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_1m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- +goose Down
DROP MATERIALIZED VIEW IF EXISTS metrics_1m;
SELECT remove_retention_policy('metrics', if_exists => true);
SELECT remove_compression_policy('metrics', if_exists => true);
DROP TABLE IF EXISTS metrics;

-- Recreate original partitioned table
CREATE TABLE metrics (
    id              BIGSERIAL,
    cluster         TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    metric_id       TEXT NOT NULL,
    value           DOUBLE PRECISION,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);
CREATE INDEX idx_metrics_source ON metrics (source_type, source_id, metric_id);
CREATE INDEX idx_metrics_id ON metrics (metric_id, captured_at);
