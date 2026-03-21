-- +goose Up
CREATE TABLE IF NOT EXISTS tap_manifests (
    pipeline_name   TEXT PRIMARY KEY,
    manifest        JSONB NOT NULL,
    flink_version   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS tap_manifests;
