-- +goose Up
ALTER TABLE jobs ADD COLUMN detail_snapshot JSONB;

-- +goose Down
ALTER TABLE jobs DROP COLUMN IF EXISTS detail_snapshot;
