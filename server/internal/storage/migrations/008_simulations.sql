-- +goose Up

CREATE TABLE simulation_runs (
    id          BIGSERIAL PRIMARY KEY,
    scenario    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'PENDING',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stopped_at  TIMESTAMPTZ,
    parameters  JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE simulation_observations (
    id          BIGSERIAL PRIMARY KEY,
    run_id      BIGINT NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric      TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    annotation  TEXT
);

CREATE INDEX idx_sim_obs_run_time ON simulation_observations(run_id, captured_at);

-- +goose Down

DROP TABLE IF EXISTS simulation_observations;
DROP TABLE IF EXISTS simulation_runs;
