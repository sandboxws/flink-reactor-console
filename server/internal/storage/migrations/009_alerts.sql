-- +goose Up
-- Server-side alerts engine: rules, instances, acknowledgements.

CREATE TABLE IF NOT EXISTS alert_rules (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    condition    JSONB NOT NULL,
    severity     TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    owner        TEXT NOT NULL DEFAULT '',
    is_preset    BOOLEAN NOT NULL DEFAULT false,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules (enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_condition_type ON alert_rules ((condition ->> 'type'));

CREATE TABLE IF NOT EXISTS alert_instances (
    id            BIGSERIAL PRIMARY KEY,
    rule_id       BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    state         TEXT NOT NULL CHECK (state IN ('FIRING', 'ACKNOWLEDGED', 'SILENCED', 'RESOLVED')),
    dedup_key     TEXT NOT NULL,
    fired_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ,
    context       JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_value DOUBLE PRECISION,
    message       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alert_instances_rule ON alert_instances (rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_state ON alert_instances (state);
CREATE INDEX IF NOT EXISTS idx_alert_instances_fired_at ON alert_instances (fired_at);

-- Partial unique index: at most one open instance per (rule, dedup_key).
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_instances_open_dedup
    ON alert_instances (rule_id, dedup_key)
    WHERE state IN ('FIRING', 'ACKNOWLEDGED');

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    id           BIGSERIAL PRIMARY KEY,
    instance_id  BIGINT NOT NULL REFERENCES alert_instances(id) ON DELETE CASCADE,
    ack_by       TEXT NOT NULL DEFAULT '',
    ack_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    note         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alert_acks_instance ON alert_acknowledgements (instance_id);

-- LISTEN/NOTIFY channel for cross-replica subscription fan-out.
-- Payload format: '{"instance_id":<n>,"state":"<state>"}'
CREATE OR REPLACE FUNCTION fn_alert_state_change_notify() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'alert_state_change',
        json_build_object(
            'instance_id', NEW.id,
            'rule_id', NEW.rule_id,
            'state', NEW.state
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_instances_notify
    AFTER INSERT OR UPDATE OF state ON alert_instances
    FOR EACH ROW
    EXECUTE FUNCTION fn_alert_state_change_notify();

-- +goose Down

DROP TRIGGER IF EXISTS trg_alert_instances_notify ON alert_instances;
DROP FUNCTION IF EXISTS fn_alert_state_change_notify;
DROP TABLE IF EXISTS alert_acknowledgements;
DROP TABLE IF EXISTS alert_instances;
DROP TABLE IF EXISTS alert_rules;
