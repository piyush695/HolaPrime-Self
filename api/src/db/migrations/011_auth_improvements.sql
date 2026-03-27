-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 011 — Auth Improvements: OTP, Rate Limiting, Remember Me
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Email verification OTP ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'registration', -- registration | password_reset | email_change
  attempts    INTEGER NOT NULL DEFAULT 0,
  verified    BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ev_email_purpose ON email_verifications(email, purpose);
CREATE INDEX IF NOT EXISTS idx_ev_expires ON email_verifications(expires_at);

-- ── Rate limit tracking ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id          SERIAL PRIMARY KEY,
  identifier  TEXT NOT NULL,  -- IP or email
  action      TEXT NOT NULL,  -- login | register | otp_send | otp_verify | password_reset
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rll_identifier_action ON rate_limit_log(identifier, action, created_at);

-- ── Extended sessions (remember me) ──────────────────────────────────────────
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Add email_verified to users ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- ── Login attempts tracking ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id          SERIAL PRIMARY KEY,
  identifier  TEXT NOT NULL, -- email or IP
  success     BOOLEAN NOT NULL DEFAULT false,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_la_identifier ON login_attempts(identifier, created_at);

-- ── Integration credentials (encrypted at app level) ────────────────────────
CREATE TABLE IF NOT EXISTS integration_credentials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT UNIQUE NOT NULL,  -- stripe | paypal | nowpayments | sumsub | smtp | mt5 | etc
  label       TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',  -- stored as {key: masked_value}
  is_active   BOOLEAN NOT NULL DEFAULT false,
  last_tested TIMESTAMPTZ,
  test_result JSONB,  -- {ok: bool, message: string, latency_ms: number}
  updated_by  UUID REFERENCES admin_users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed integration records so they appear in admin even before configured
INSERT INTO integration_credentials (service, label, credentials, is_active) VALUES
  ('stripe',       'Stripe',                '{"secretKey":"","webhookSecret":"","publishableKey":""}', false),
  ('paypal',       'PayPal',                '{"clientId":"","clientSecret":"","webhookId":"","env":"production"}', false),
  ('nowpayments',  'NOWPayments (Crypto)',   '{"apiKey":"","ipnSecret":"","defaultCoin":"USDTTRC20"}', false),
  ('flutterwave',  'Flutterwave',            '{"secretKey":"","publicKey":"","encryptionKey":"","webhookSecret":""}', false),
  ('razorpay',     'Razorpay',               '{"keyId":"","keySecret":"","webhookSecret":""}', false),
  ('skrill',       'Skrill',                 '{"merchantEmail":"","secretWord":"","merchantId":""}', false),
  ('neteller',     'Neteller',               '{"clientId":"","clientSecret":"","env":"production"}', false),
  ('bank_transfer','Bank Transfer',          '{"bankName":"","accountName":"","accountNumber":"","sortCode":"","swiftBic":"","iban":"","instructions":""}', false),
  ('sumsub',       'Sumsub KYC',             '{"appToken":"","secretKey":"","levelName":"basic-kyc-level","webhookSecret":""}', false),
  ('smtp',         'SMTP Email',             '{"host":"","port":"587","user":"","pass":"","from":"noreply@holaprime.com","fromName":"Hola Prime"}', false),
  ('sendgrid',     'SendGrid',               '{"apiKey":"","from":"noreply@holaprime.com","fromName":"Hola Prime"}', false),
  ('mailmodo',     'Mailmodo',               '{"apiKey":"","from":"noreply@holaprime.com"}', false),
  ('mt5',          'MetaTrader 5',           '{"apiUrl":"","apiKey":"","server":"","managerLogin":"","managerPassword":""}', false),
  ('ctrader',      'cTrader',                '{"clientId":"","clientSecret":"","accountId":"","env":"demo"}', false),
  ('dxtrade',      'DXTrade',                '{"apiUrl":"","apiKey":"","brokerName":""}', false),
  ('matchtrader',  'MatchTrader',            '{"apiUrl":"","apiKey":"","brokerId":""}', false),
  ('tradovate',    'Tradovate',              '{"username":"","password":"","appId":"","appVersion":"1.0","cid":"","secret":"","env":"demo"}', false),
  ('whatsapp',     'WhatsApp (Meta)',         '{"phoneId":"","token":"","verifyToken":""}', false)
ON CONFLICT (service) DO NOTHING;
