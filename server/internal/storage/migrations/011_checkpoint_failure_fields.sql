-- +goose Up
-- Persist checkpoint failure reasons and restore paths so incident history
-- survives Flink's retained-checkpoint cap.

ALTER TABLE checkpoints ADD COLUMN failure_message TEXT;
ALTER TABLE checkpoints ADD COLUMN failure_timestamp TIMESTAMPTZ;
ALTER TABLE checkpoints ADD COLUMN external_path TEXT;

-- +goose Down
ALTER TABLE checkpoints DROP COLUMN IF EXISTS external_path;
ALTER TABLE checkpoints DROP COLUMN IF EXISTS failure_timestamp;
ALTER TABLE checkpoints DROP COLUMN IF EXISTS failure_message;
