-- =============================================================================
-- Hola Prime Admin Platform — Phase 3 Schema
-- Settings · Webhooks · Reports · Tournaments · Analytics · Trader Portal
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE webhook_event AS ENUM (
  'user.registered','user.kyc_approved','user.kyc_rejected',
  'account.created','account.breached','account.passed','account.funded',
  'payment.completed','payment.failed',
  'payout.approved','payout.rejected',
  'risk.breach','risk.warning'
);
CREATE TYPE report_frequency AS ENUM ('daily','weekly','monthly','quarterly','one_time');
CREATE TYPE report_status     AS ENUM ('pending','running','completed','failed');
CREATE TYPE report_format     AS ENUM ('pdf','csv','xlsx','json');
CREATE TYPE bracket_status    AS ENUM ('pending','active','completed','cancelled');

-- =============================================================================
-- SETTINGS
-- =============================================================================

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT false,  -- safe to expose to trader portal
  updated_by  UUID REFERENCES admin_users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings seed
INSERT INTO settings (key, value, description, is_public) VALUES
  ('platform.name',          '"Hola Prime Markets"',          'Platform display name',            true),
  ('platform.support_email', '"support@holaprime.com"','Support contact email',            true),
  ('platform.currency',      '"USD"',                         'Default currency',                 true),
  ('platform.timezone',      '"UTC"',                         'Default timezone',                 true),
  ('challenges.enabled',     'true',                          'Whether new challenge purchases are enabled', true),
  ('kyc.required',           'true',                          'KYC required before trading',      true),
  ('kyc.auto_approve',       'false',                         'Auto-approve KYC submissions',     false),
  ('payouts.min_amount',     '100',                           'Minimum payout request amount USD',true),
  ('payouts.auto_approve',   'false',                         'Auto-approve payouts under threshold', false),
  ('payouts.auto_threshold', '500',                           'Auto-approve threshold USD',       false),
  ('email.from_name',        '"Hola Prime"',                  'Email sender display name',        false),
  ('maintenance.enabled',    'false',                         'Put platform in maintenance mode', false),
  ('maintenance.message',    '"Platform under maintenance. Back shortly."', 'Maintenance message', true)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- WEBHOOKS
-- =============================================================================

CREATE TABLE webhook_endpoints (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  secret       TEXT NOT NULL,                  -- HMAC signing secret
  events       webhook_event[] NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  headers      JSONB NOT NULL DEFAULT '{}',    -- custom headers
  retry_count  INTEGER NOT NULL DEFAULT 3,
  last_ping_at TIMESTAMPTZ,
  last_ping_ok BOOLEAN,
  created_by   UUID REFERENCES admin_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event           webhook_event NOT NULL,
  payload         JSONB NOT NULL,
  status_code     INTEGER,
  response_body   TEXT,
  attempt         INTEGER NOT NULL DEFAULT 1,
  delivered_at    TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_event    ON webhook_deliveries(event, created_at DESC);

-- =============================================================================
-- REPORTS
-- =============================================================================

CREATE TABLE report_definitions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL,                 -- 'revenue','users','risk','affiliates','custom'
  query_config  JSONB NOT NULL DEFAULT '{}',   -- filters, groupings, date ranges
  frequency     report_frequency,
  format        report_format NOT NULL DEFAULT 'xlsx',
  recipients    TEXT[] NOT NULL DEFAULT '{}',  -- email addresses
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES admin_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  definition_id   UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  status          report_status NOT NULL DEFAULT 'pending',
  format          report_format NOT NULL DEFAULT 'xlsx',
  file_url        TEXT,                        -- GCS signed URL once generated
  file_size       INTEGER,
  row_count       INTEGER,
  error           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  triggered_by    UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_runs_definition ON report_runs(definition_id, created_at DESC);

-- =============================================================================
-- TOURNAMENTS (full schema replacing Phase 1 stub)
-- =============================================================================

-- tournament_entries already exists from phase 1, add missing columns
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS phase1_min_return  NUMERIC(8,4) NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS top_per_country    INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS bracket_size       INTEGER NOT NULL DEFAULT 64,
  ADD COLUMN IF NOT EXISTS seeding_method     TEXT NOT NULL DEFAULT 'phase2_return',
  ADD COLUMN IF NOT EXISTS public_leaderboard BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS banner_url         TEXT,
  ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ;

CREATE TABLE tournament_countries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  country_code    CHAR(2) NOT NULL,
  country_name    TEXT NOT NULL,
  registrations   INTEGER NOT NULL DEFAULT 0,
  qualifiers      INTEGER NOT NULL DEFAULT 0,
  champion_id     UUID REFERENCES tournament_entries(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, country_code)
);

CREATE TABLE tournament_bracket (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round           TEXT NOT NULL,               -- 'r64','r32','r16','qf','sf','final'
  match_number    INTEGER NOT NULL,
  seed1_entry_id  UUID REFERENCES tournament_entries(id),
  seed2_entry_id  UUID REFERENCES tournament_entries(id),
  seed1_return    NUMERIC(10,4),
  seed2_return    NUMERIC(10,4),
  winner_entry_id UUID REFERENCES tournament_entries(id),
  status          bracket_status NOT NULL DEFAULT 'pending',
  account1_id     UUID REFERENCES trading_accounts(id),
  account2_id     UUID REFERENCES trading_accounts(id),
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, round, match_number)
);

CREATE INDEX idx_bracket_tournament ON tournament_bracket(tournament_id, round);
CREATE INDEX idx_tournament_countries ON tournament_countries(tournament_id);

-- =============================================================================
-- ANALYTICS EVENTS (ClickHouse-compatible schema, stored in Postgres for now)
-- Phase 4: migrate to ClickHouse for scale
-- =============================================================================

CREATE TABLE analytics_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event        TEXT NOT NULL,
  user_id      UUID,
  session_id   TEXT,
  properties   JSONB NOT NULL DEFAULT '{}',
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_event_name ON analytics_events(event, ts DESC);
CREATE INDEX idx_analytics_event_user ON analytics_events(user_id, ts DESC);
CREATE INDEX idx_analytics_event_ts   ON analytics_events(ts DESC);

-- =============================================================================
-- TRADER PORTAL — notifications, support tickets
-- =============================================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

CREATE TABLE support_tickets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to  UUID REFERENCES admin_users(id),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE support_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id  UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL,                    -- user or admin
  is_admin   BOOLEAN NOT NULL DEFAULT false,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user   ON support_tickets(user_id, created_at DESC);
CREATE INDEX idx_tickets_status ON support_tickets(status, created_at DESC);
