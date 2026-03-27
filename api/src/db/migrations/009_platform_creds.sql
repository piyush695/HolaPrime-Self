-- =============================================================================
-- Hola Prime — Migration 009
-- Platform Credentials Storage (DB-backed, no env var restart required)
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_credentials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform      TEXT NOT NULL UNIQUE,         -- mt5, ctrader, matchtrader, ninjatrader, tradovate
  credentials   JSONB NOT NULL DEFAULT '{}',  -- encrypted-at-rest in prod; API URL, keys, etc.
  is_active     BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  last_test_ok   BOOLEAN,
  last_test_msg  TEXT,
  updated_by    UUID REFERENCES admin_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_credentials (platform, credentials, is_active) VALUES
  ('mt5',         '{}', false),
  ('ctrader',     '{}', false),
  ('matchtrader', '{}', false),
  ('ninjatrader', '{}', false),
  ('tradovate',   '{}', false)
ON CONFLICT (platform) DO NOTHING;

-- Add event_id column to s2s_event_log for deduplication tracking
ALTER TABLE s2s_event_log
  ADD COLUMN IF NOT EXISTS event_id TEXT;   -- UUID passed for Meta/pixel deduplication

CREATE INDEX IF NOT EXISTS idx_s2s_log_event_id ON s2s_event_log(event_id) WHERE event_id IS NOT NULL;
