-- Command dashboard snapshots and team thread.
-- Idempotent. No seed rows: operational data stays out of git.
-- Row level security is on and no anon or authenticated policies are created,
-- so only the service role used by the staff API can read or write these tables.

CREATE SCHEMA IF NOT EXISTS pipeline;

CREATE TABLE IF NOT EXISTS pipeline.command_dashboard_snapshots (
  section TEXT PRIMARY KEY,
  byron_only BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline.command_dashboard_thread (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL DEFAULT 'all',
  seat TEXT,
  message TEXT NOT NULL
);

ALTER TABLE pipeline.command_dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline.command_dashboard_thread ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA pipeline TO service_role;
GRANT ALL ON TABLE pipeline.command_dashboard_snapshots TO service_role;
GRANT ALL ON TABLE pipeline.command_dashboard_thread TO service_role;
GRANT USAGE, SELECT ON SEQUENCE pipeline.command_dashboard_thread_id_seq TO service_role;
