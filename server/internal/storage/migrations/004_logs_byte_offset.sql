-- +goose Up
-- Add byte_offset tracking and unique constraint for incremental log sync.

ALTER TABLE logs ADD COLUMN byte_offset BIGINT NOT NULL DEFAULT 0;

-- Unique constraint enables ON CONFLICT upsert by log source identity.
ALTER TABLE logs ADD CONSTRAINT uq_logs_source
    UNIQUE (cluster, source_type, source_id, log_file);

-- +goose Down
ALTER TABLE logs DROP CONSTRAINT IF EXISTS uq_logs_source;
ALTER TABLE logs DROP COLUMN IF EXISTS byte_offset;
