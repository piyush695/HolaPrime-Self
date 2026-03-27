-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 013 — Marketing Features: Re-engagement, LTV, Funnel, Geo, Social Proof
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Re-engagement triggers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reengagement_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_event   TEXT NOT NULL,   -- registered | purchased | passed | breached | inactive_7d | inactive_30d | kyc_pending | cart_abandon
  delay_hours     INTEGER NOT NULL DEFAULT 0,
  channel         TEXT NOT NULL DEFAULT 'email',  -- email | whatsapp | both
  subject         TEXT,            -- email subject
  message_body    TEXT NOT NULL,   -- email HTML or WhatsApp message
  enabled         BOOLEAN NOT NULL DEFAULT true,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  open_count      INTEGER NOT NULL DEFAULT 0,
  click_count     INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reengagement_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id      UUID NOT NULL REFERENCES reengagement_triggers(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  channel         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | opened | clicked | converted | failed
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ,
  error_msg       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reeng_sends_user ON reengagement_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_reeng_sends_trigger ON reengagement_sends(trigger_id, status);

-- Seed default triggers
INSERT INTO reengagement_triggers (name, trigger_event, delay_hours, channel, subject, message_body, enabled) VALUES
  ('Welcome Series: Day 1',        'registered',    2,   'email',    'Welcome to Hola Prime — here''s how to get started 🚀',
   '<h1>Welcome to Hola Prime!</h1><p>Hi {{first_name}},</p><p>You''ve joined 20,000+ funded traders. Here''s how to start your journey:</p><p><a href="{{cta_url}}">Browse Challenge Plans →</a></p>',
   true),
  ('Purchase Follow-up',           'purchased',     1,   'email',    'Your challenge has started — tips for success 🎯',
   '<h1>Your challenge is live!</h1><p>Hi {{first_name}}, your {{challenge_name}} challenge has started. Here are your key rules to remember...</p>',
   true),
  ('KYC Reminder',                 'kyc_pending',   48,  'email',    'Action needed: Complete your KYC to get funded 📋',
   '<h1>Don''t miss your payout!</h1><p>Hi {{first_name}}, you''ve passed your challenge but need to complete KYC to receive your funded account. <a href="{{kyc_url}}">Complete KYC →</a></p>',
   true),
  ('7-Day Inactive',               'inactive_7d',   0,   'email',    'We miss you! Your account is waiting 👀',
   '<h1>Come back and trade!</h1><p>Hi {{first_name}}, you haven''t logged in for 7 days. Don''t let your progress slip. <a href="{{login_url}}">Sign in →</a></p>',
   true),
  ('Account Breached Recovery',    'breached',      4,   'email',    'Your account was breached — get back in the game 💪',
   '<h1>Every trader faces setbacks</h1><p>Hi {{first_name}}, your account was breached but that''s part of trading. Use code {{promo_code}} for 20% off your next challenge. <a href="{{cta_url}}">Try again →</a></p>',
   false),
  ('30-Day Win-back',              'inactive_30d',  0,   'email',    'Special offer — 15% off any challenge 🎁',
   '<h1>We have an offer for you</h1><p>Hi {{first_name}}, it''s been a while. Use code COMEBACK15 for 15% off any challenge. Offer expires in 48 hours. <a href="{{cta_url}}">Claim offer →</a></p>',
   false)
ON CONFLICT DO NOTHING;

-- ── LTV Snapshots (computed daily by background job) ─────────────────────────
CREATE TABLE IF NOT EXISTS ltv_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  total_spent     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- sum of all challenge fees
  total_payouts   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- sum of payouts received
  challenges_bought INTEGER NOT NULL DEFAULT 0,
  challenges_passed INTEGER NOT NULL DEFAULT 0,
  pass_rate       NUMERIC(5,2),
  first_purchase_date DATE,
  last_purchase_date  DATE,
  days_as_customer INTEGER,
  acquisition_channel TEXT,                           -- from first ad_click
  acquisition_campaign TEXT,
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ltv_user ON ltv_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_ltv_channel ON ltv_snapshots(acquisition_channel, snapshot_date);

-- ── Social proof feed ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_proof_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,                      -- payout | challenge_pass | new_trader | funded
  trader_name     TEXT NOT NULL,                      -- display name (may be anonymised)
  trader_country  TEXT,
  trader_flag     TEXT,
  amount          NUMERIC(12,2),
  challenge_name  TEXT,
  platform        TEXT,
  is_visible      BOOLEAN NOT NULL DEFAULT true,
  is_verified     BOOLEAN NOT NULL DEFAULT true,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_visible ON social_proof_events(is_visible, occurred_at DESC);
