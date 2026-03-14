-- 001_initial.down.sql
-- Drops all tables in reverse dependency order.

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
