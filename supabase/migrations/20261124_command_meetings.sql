-- Live ticks for staff meeting agendas.
-- The agenda itself stays in api/_meetings/seed.json. This table stores only
-- the overlay: item status, notes, action ticks, and actions added on the call.
-- Idempotent. No seed rows. Row level security is on and no anon or
-- authenticated policies are created, so only the service role used by the
-- staff API can read or write this table.

CREATE SCHEMA IF NOT EXISTS pipeline;

CREATE TABLE IF NOT EXISTS pipeline.command_meeting_progress (
  meeting_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

ALTER TABLE pipeline.command_meeting_progress ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA pipeline TO service_role;
GRANT ALL ON TABLE pipeline.command_meeting_progress TO service_role;
