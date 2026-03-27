-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 010 — Operations Control Centre
-- All feature flags, content management, and ops control tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Feature Flags ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id           SERIAL PRIMARY KEY,
  key          TEXT UNIQUE NOT NULL,
  label        TEXT NOT NULL,
  description  TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  category     TEXT NOT NULL DEFAULT 'general',
  updated_by   UUID REFERENCES admin_users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (key, label, description, enabled, category) VALUES
  ('leaderboard',       'Leaderboard',         'Show leaderboard to traders',               true,  'trader_portal'),
  ('tournaments',       'Tournaments',          'Show tournaments section',                   true,  'trader_portal'),
  ('affiliate_program', 'Affiliate Program',   'Enable affiliate dashboard & links',         true,  'trader_portal'),
  ('prime_academy',     'Prime Academy',        'Show Prime Academy content',                 true,  'trader_portal'),
  ('competition',       'Competition',          'Show competition section',                   true,  'trader_portal'),
  ('crypto_payouts',    'Crypto Payouts',       'Allow crypto payout requests',               true,  'payouts'),
  ('bank_payouts',      'Bank Transfer Payouts','Allow bank wire payout requests',            true,  'payouts'),
  ('paypal_payouts',    'PayPal Payouts',        'Allow PayPal payout requests',              true,  'payouts'),
  ('auto_kyc',          'Auto KYC',             'Auto-approve KYC via Sumsub',                true,  'compliance'),
  ('maintenance_mode',  'Maintenance Mode',     'Show maintenance page to all traders',       false, 'system'),
  ('new_registrations', 'New Registrations',    'Allow new trader registrations',             true,  'system'),
  ('blog_section',      'Blog Section',         'Show blog on public site',                   true,  'marketing'),
  ('referral_rewards',  'Referral Rewards',     'Enable trader-side referral rewards',        true,  'marketing')
ON CONFLICT (key) DO NOTHING;

-- ── Site Content (announcement bar, stats, etc.) ──────────────────────────────
CREATE TABLE IF NOT EXISTS site_content (
  id           SERIAL PRIMARY KEY,
  key          TEXT UNIQUE NOT NULL,
  value        JSONB NOT NULL DEFAULT '{}',
  label        TEXT NOT NULL,
  description  TEXT,
  content_type TEXT NOT NULL DEFAULT 'json', -- json | text | html | boolean
  updated_by   UUID REFERENCES admin_users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_content (key, label, description, value, content_type) VALUES
  ('announcement_bar', 'Announcement Bar', 'Top announcement bar on all pages',
    '{"enabled":true,"text":"Play Dunk Trade & Get 15% OFF","link":"/register","link_text":"Play Now","bg_color":"#4F8CF7"}',
    'json'),
  ('homepage_stats', 'Homepage Stats', 'Stats shown in hero and about sections',
    '{"funded_traders":"20,000+","countries":"175+","avg_payout":"33m 48s","total_payouts":"$4.5M+","fastest_payout":"3m 37s","avg_payout_amount":"$4,500"}',
    'json'),
  ('footer_tagline', 'Footer Tagline', 'Tagline shown in footer',
    '"The most transparent prop firm. Built by traders, for traders."',
    'text'),
  ('maintenance_message', 'Maintenance Message', 'Message shown during maintenance',
    '"We are performing scheduled maintenance. We will be back shortly."',
    'text'),
  ('zero_denial_stats', 'Zero Denial Stats', 'Stats for the zero denial section',
    '{"avg_time":"33m 48s","fastest_time":"3m 37s","avg_amount":"$4,500","max_split":"95%"}',
    'json')
ON CONFLICT (key) DO NOTHING;

-- ── Promo Codes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  description    TEXT,
  discount_type  TEXT NOT NULL DEFAULT 'percentage', -- percentage | fixed
  discount_value NUMERIC(10,2) NOT NULL,
  min_purchase   NUMERIC(10,2) DEFAULT 0,
  max_uses       INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  applicable_to  JSONB DEFAULT '["all"]', -- ["all"] or specific slug list
  valid_from     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until    TIMESTAMPTZ,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES admin_users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_uses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      UUID NOT NULL REFERENCES promo_codes(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  order_id     TEXT,
  discount_amt NUMERIC(10,2),
  used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Country Controls ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS country_controls (
  id              SERIAL PRIMARY KEY,
  country_code    CHAR(2) UNIQUE NOT NULL,
  country_name    TEXT NOT NULL,
  registration    BOOLEAN NOT NULL DEFAULT true,
  payouts         BOOLEAN NOT NULL DEFAULT true,
  kyc_required    BOOLEAN NOT NULL DEFAULT false,
  risk_tier       TEXT NOT NULL DEFAULT 'standard', -- standard | enhanced | restricted
  max_payout      NUMERIC(12,2),
  notes           TEXT,
  updated_by      UUID REFERENCES admin_users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO country_controls (country_code, country_name, registration, payouts, risk_tier) VALUES
  ('US','United States',true,true,'standard'),
  ('GB','United Kingdom',true,true,'standard'),
  ('IN','India',true,true,'standard'),
  ('AE','United Arab Emirates',true,true,'standard'),
  ('DE','Germany',true,true,'standard'),
  ('NG','Nigeria',true,true,'enhanced'),
  ('PK','Pakistan',true,true,'enhanced'),
  ('AF','Afghanistan',false,false,'restricted'),
  ('BY','Belarus',false,false,'restricted'),
  ('KP','North Korea',false,false,'restricted'),
  ('CU','Cuba',false,false,'restricted'),
  ('IR','Iran',false,false,'restricted'),
  ('CN','China',false,false,'restricted'),
  ('RU','Russia',true,true,'enhanced')
ON CONFLICT (country_code) DO NOTHING;

-- ── Payout Approval Workflow ──────────────────────────────────────────────────
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS reviewed_by   UUID REFERENCES admin_users(id);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS review_notes  TEXT;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS payout_rules (
  id            SERIAL PRIMARY KEY,
  rule_key      TEXT UNIQUE NOT NULL,
  label         TEXT NOT NULL,
  value         JSONB NOT NULL,
  description   TEXT,
  updated_by    UUID REFERENCES admin_users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO payout_rules (rule_key, label, value, description) VALUES
  ('min_amount',          'Minimum Payout Amount',      '{"value":50}',     'Minimum USD amount for any payout request'),
  ('max_daily',           'Max Payouts Per Day',         '{"value":3}',      'Max payout requests per trader per day'),
  ('kyc_required_above',  'KYC Required Above',          '{"value":0}',      'KYC required for payouts above this USD amount (0=always)'),
  ('auto_approve_below',  'Auto-approve Below',          '{"value":0}',      'Auto-approve payouts below this amount (0=disabled)'),
  ('cooldown_hours',      'Cooldown Between Payouts',    '{"value":24}',     'Hours trader must wait between payouts'),
  ('velocity_flag_count', 'Velocity Flag Threshold',     '{"value":5}',      'Flag if more than N payouts in 7 days'),
  ('max_pct_of_balance',  'Max % of Balance Per Payout', '{"value":100}',    'Max payout as % of account balance')
ON CONFLICT (rule_key) DO NOTHING;

-- ── Email Templates ─────────────────────────────────────────────────────────
-- Drop and recreate with correct schema (safe: migrations always run on fresh DB)
DROP TABLE IF EXISTS email_templates CASCADE;
CREATE TABLE email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT UNIQUE NOT NULL,
  label        TEXT NOT NULL,
  subject      TEXT NOT NULL,
  html_body    TEXT NOT NULL,
  text_body    TEXT,
  variables    JSONB NOT NULL DEFAULT '[]',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  updated_by   UUID REFERENCES admin_users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO email_templates (key, label, subject, html_body, variables) VALUES
  ('welcome',         'Welcome Email',     'Welcome to Hola Prime, {{first_name}}!',
   '<h1>Welcome {{first_name}}!</h1><p>Your Hola Prime account is ready. <a href="{{login_url}}">Sign in now</a>.</p>',
   '["first_name","last_name","email","login_url"]'),
  ('kyc_approved',    'KYC Approved',      'Your identity has been verified ✅',
   '<h1>Hi {{first_name}},</h1><p>Your KYC has been approved. You can now request payouts.</p>',
   '["first_name","last_name"]'),
  ('kyc_rejected',    'KYC Rejected',      'Action required: KYC verification',
   '<h1>Hi {{first_name}},</h1><p>Your KYC was rejected. Reason: {{reason}}. Please contact support.</p>',
   '["first_name","reason","support_url"]'),
  ('payout_sent',     'Payout Sent',       'Your payout of {{amount}} has been sent 💸',
   '<h1>Payout Sent!</h1><p>Hi {{first_name}}, your payout of {{amount}} via {{method}} has been processed.</p>',
   '["first_name","amount","method","transaction_id"]'),
  ('challenge_passed','Challenge Passed',  'Congratulations! You passed the challenge 🎉',
   '<h1>You passed! 🎉</h1><p>Hi {{first_name}}, complete KYC to receive your funded account.</p>',
   '["first_name","challenge_name","account_size","kyc_url"]'),
  ('payout_rejected', 'Payout Rejected',   'Payout request update',
   '<h1>Hi {{first_name}},</h1><p>Your payout of {{amount}} was not processed. Reason: {{reason}}.</p>',
   '["first_name","amount","reason","support_url"]'),
  ('otp_registration','OTP Registration',  'Your Hola Prime verification code',
   '<div style="font-family:sans-serif;max-width:480px;padding:32px;background:#0B1120;color:#F1F5F9;border-radius:12px"><h2>Verification Code</h2><p style="font-size:32px;font-weight:900;letter-spacing:8px;color:#4F8CF7">{{otp}}</p><p style="color:#94A3B8">Expires in 10 minutes. Do not share this code.</p></div>',
   '["otp","first_name"]'),
  ('password_reset',  'Password Reset',    'Reset your Hola Prime password',
   '<div style="font-family:sans-serif;max-width:480px;padding:32px;background:#0B1120;color:#F1F5F9;border-radius:12px"><h2>Reset Code</h2><p style="font-size:32px;font-weight:900;letter-spacing:8px;color:#4F8CF7">{{otp}}</p><p style="color:#94A3B8">Expires in 10 minutes. If you did not request this, ignore this email.</p></div>',
   '["otp","first_name"]')
ON CONFLICT (key) DO NOTHING;



-- ── FAQ Manager ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faq_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page         TEXT NOT NULL DEFAULT 'general', -- general | forex | futures | affiliate | payout
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES admin_users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Testimonials ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_name  TEXT NOT NULL,
  country      TEXT NOT NULL,
  country_flag TEXT NOT NULL DEFAULT '🌍',
  payout_amount TEXT,
  quote        TEXT NOT NULL,
  rating       INTEGER NOT NULL DEFAULT 5,
  verified     BOOLEAN NOT NULL DEFAULT false,
  featured     BOOLEAN NOT NULL DEFAULT false,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES admin_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Blog CMS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  excerpt      TEXT,
  body         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general',
  tags         JSONB DEFAULT '[]',
  featured_img TEXT,
  author_name  TEXT NOT NULL DEFAULT 'Hola Prime Team',
  status       TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  meta_title   TEXT,
  meta_desc    TEXT,
  read_time    INTEGER DEFAULT 5,
  created_by   UUID REFERENCES admin_users(id),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Support Tickets ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS ticket_replies CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
CREATE TABLE support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no    TEXT UNIQUE NOT NULL,
  user_id      UUID REFERENCES users(id),
  subject      TEXT NOT NULL,
  message      TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general',
  priority     TEXT NOT NULL DEFAULT 'normal',
  status       TEXT NOT NULL DEFAULT 'open',
  assigned_to  UUID REFERENCES admin_users(id),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id   UUID,
  author_type TEXT NOT NULL DEFAULT 'trader',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── IP Blocklist ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ip_blocklist (
  id         SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  reason     TEXT,
  blocked_by UUID REFERENCES admin_users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_blocklist_ip ON ip_blocklist(ip_address);

-- ── Velocity / Fraud Rules ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  flag_type  TEXT NOT NULL, -- velocity | ip_match | device_match | pattern
  details    JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'open', -- open | reviewed | dismissed | actioned
  reviewed_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Analytics snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily (
  id              SERIAL PRIMARY KEY,
  snapshot_date   DATE UNIQUE NOT NULL,
  new_users       INTEGER DEFAULT 0,
  new_challenges  INTEGER DEFAULT 0,
  revenue         NUMERIC(12,2) DEFAULT 0,
  payouts_count   INTEGER DEFAULT 0,
  payouts_amount  NUMERIC(12,2) DEFAULT 0,
  pass_rate       NUMERIC(5,2) DEFAULT 0,
  active_traders  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Platform Health ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_health_log (
  id           SERIAL PRIMARY KEY,
  platform     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ok', -- ok | degraded | down
  response_ms  INTEGER,
  error_msg    TEXT,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
