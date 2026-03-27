-- =============================================================================
-- Hola Prime — Migration 005
-- S2S Event Integrations · Product Display Fields · Account Type Labels
-- =============================================================================

-- ── S2S Integration registry ───────────────────────────────────────────────────
CREATE TYPE integration_type AS ENUM (
  'meta_capi',
  'google_ga4',
  'tiktok_events',
  'mixpanel',
  'segment',
  'amplitude',
  'posthog',
  'klaviyo',
  'custom_http'
);

CREATE TABLE s2s_integrations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,                      -- human label, e.g. "Meta - Purchase"
  type          integration_type NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',         -- credentials (pixel_id, access_token etc)
  is_active     BOOLEAN NOT NULL DEFAULT false,
  -- Event mapping: which internal events trigger this integration
  -- e.g. {"user.registered": "Lead", "payment.completed": "Purchase"}
  event_map     JSONB NOT NULL DEFAULT '{}',
  -- Field mapping: map our fields to the integration's expected fields
  -- e.g. {"email": "em", "phone": "ph", "value": "value"}
  field_map     JSONB NOT NULL DEFAULT '{}',
  -- Last 10 test/live send results
  last_results  JSONB NOT NULL DEFAULT '[]',
  last_fired_at TIMESTAMPTZ,
  created_by    UUID REFERENCES admin_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event log — every outbound S2S call recorded for debugging
CREATE TABLE s2s_event_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES s2s_integrations(id) ON DELETE CASCADE,
  internal_event  TEXT NOT NULL,
  external_event  TEXT NOT NULL,
  user_id         UUID REFERENCES users(id),
  payload_sent    JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body   TEXT,
  success         BOOLEAN NOT NULL DEFAULT false,
  duration_ms     INTEGER,
  is_test         BOOLEAN NOT NULL DEFAULT false,
  error           TEXT,
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_s2s_log_integration ON s2s_event_log(integration_id, fired_at DESC);
CREATE INDEX idx_s2s_log_event       ON s2s_event_log(internal_event, fired_at DESC);
CREATE INDEX idx_s2s_log_user        ON s2s_event_log(user_id, fired_at DESC);

-- ── Product display & configuration extensions ─────────────────────────────────
ALTER TABLE challenge_products
  ADD COLUMN IF NOT EXISTS badge_text       TEXT,                    -- "Popular", "Best Value" etc
  ADD COLUMN IF NOT EXISTS badge_color      TEXT DEFAULT '#3F8FE0',  -- hex color
  ADD COLUMN IF NOT EXISTS icon             TEXT DEFAULT '🏆',
  ADD COLUMN IF NOT EXISTS highlight        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS short_tagline    TEXT,
  ADD COLUMN IF NOT EXISTS features         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_accounts     INTEGER,                 -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS refund_policy    TEXT,
  ADD COLUMN IF NOT EXISTS group_prefix     TEXT;                    -- MT5 group prefix override

-- ── Account phase display labels ───────────────────────────────────────────────
CREATE TABLE account_phase_labels (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_key    TEXT NOT NULL UNIQUE,           -- 'evaluation', 'verification', 'funded'
  label        TEXT NOT NULL,                  -- "Evaluation", "Verification", "Funded"
  short_label  TEXT NOT NULL,                  -- "Eval", "Verif", "Live"
  color        TEXT NOT NULL DEFAULT '#3F8FE0',
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO account_phase_labels (phase_key, label, short_label, color, description) VALUES
  ('evaluation',   'Evaluation',   'Eval',   '#3F8FE0', 'First phase — prove your strategy'),
  ('verification', 'Verification', 'Verif',  '#14B8A6', 'Second phase — confirm consistency'),
  ('funded',       'Funded',       'Live',   '#F5B326', 'Funded account — trade with our capital')
ON CONFLICT (phase_key) DO NOTHING;

-- ── Account status display labels ─────────────────────────────────────────────
CREATE TABLE account_status_labels (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status_key   TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#878FA4',
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO account_status_labels (status_key, label, color, description) VALUES
  ('active',    'Active',          '#38BA82', 'Account is trading'),
  ('pending',   'Pending',         '#3F8FE0', 'Being provisioned'),
  ('passed',    'Passed',          '#8B5CF6', 'Phase objective met'),
  ('funded',    'Funded',          '#F5B326', 'Live funded account'),
  ('breached',  'Rules Breached',  '#EB5454', 'Drawdown limit hit'),
  ('failed',    'Failed',          '#4F5669', 'Did not meet objective'),
  ('closed',    'Closed',          '#4F5669', 'Manually closed')
ON CONFLICT (status_key) DO NOTHING;
