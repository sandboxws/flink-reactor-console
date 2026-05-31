-- +goose Up
-- State-collision detection: versioned pipeline State Manifests, the
-- compatibility checks computed against them, and observed restore outcomes.

CREATE TABLE IF NOT EXISTS pipeline_manifests (
    id                BIGSERIAL PRIMARY KEY,
    pipeline_name     TEXT NOT NULL,
    environment       TEXT NOT NULL DEFAULT 'default',
    version           INTEGER NOT NULL,
    flink_version     TEXT,
    manifest          JSONB NOT NULL,
    state_fingerprint TEXT NOT NULL,
    operator_states   JSONB NOT NULL DEFAULT '[]'::jsonb,
    source            TEXT NOT NULL DEFAULT 'cli',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monotonic version per (pipeline, environment); enforced on insert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_manifests_version
    ON pipeline_manifests (pipeline_name, environment, version);
CREATE INDEX IF NOT EXISTS idx_pipeline_manifests_lookup
    ON pipeline_manifests (pipeline_name, environment, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_manifests_fingerprint
    ON pipeline_manifests (state_fingerprint);

CREATE TABLE IF NOT EXISTS compatibility_checks (
    id               BIGSERIAL PRIMARY KEY,
    pipeline_name    TEXT NOT NULL,
    environment      TEXT NOT NULL DEFAULT 'default',
    from_manifest_id BIGINT REFERENCES pipeline_manifests(id) ON DELETE SET NULL,
    to_manifest_id   BIGINT REFERENCES pipeline_manifests(id) ON DELETE SET NULL,
    from_version     INTEGER,
    to_version       INTEGER,
    verdict          TEXT NOT NULL CHECK (verdict IN ('COMPATIBLE', 'WARNING', 'INCOMPATIBLE')),
    can_proceed      BOOLEAN NOT NULL,
    issues           JSONB NOT NULL DEFAULT '[]'::jsonb,
    checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compat_checks_pipeline
    ON compatibility_checks (pipeline_name, environment, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_compat_checks_verdict
    ON compatibility_checks (verdict);

CREATE TABLE IF NOT EXISTS restore_events (
    id                     BIGSERIAL PRIMARY KEY,
    pipeline_name          TEXT NOT NULL,
    environment            TEXT NOT NULL DEFAULT 'default',
    cluster                TEXT NOT NULL,
    jid                    TEXT,
    manifest_id            BIGINT REFERENCES pipeline_manifests(id) ON DELETE SET NULL,
    check_id               BIGINT REFERENCES compatibility_checks(id) ON DELETE SET NULL,
    bluegreen_name         TEXT,
    outcome                TEXT NOT NULL CHECK (outcome IN ('PENDING', 'SUCCESS', 'FAILED', 'UNKNOWN')),
    error_category         TEXT,
    -- Plain ids (no cross-table FK): checkpoints has a composite PK and the
    -- exceptions row may be pruned independently. The link is by value.
    restored_checkpoint_id BIGINT,
    restored_path          TEXT,
    exception_id           BIGINT,
    detail                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restore_events_pipeline
    ON restore_events (pipeline_name, environment, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_restore_events_job
    ON restore_events (cluster, jid);
CREATE INDEX IF NOT EXISTS idx_restore_events_category
    ON restore_events (error_category)
    WHERE error_category IS NOT NULL;

-- +goose Down

DROP TABLE IF EXISTS restore_events;
DROP TABLE IF EXISTS compatibility_checks;
DROP TABLE IF EXISTS pipeline_manifests;
