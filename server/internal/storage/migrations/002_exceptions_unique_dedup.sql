-- +goose Up
-- Make the exceptions dedup index unique so ON CONFLICT DO NOTHING works.
DROP INDEX IF EXISTS idx_exceptions_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exceptions_dedup ON exceptions (jid, cluster, exception_name, timestamp);

-- +goose Down
DROP INDEX IF EXISTS idx_exceptions_dedup;
CREATE INDEX IF NOT EXISTS idx_exceptions_dedup ON exceptions (jid, cluster, exception_name, timestamp);
