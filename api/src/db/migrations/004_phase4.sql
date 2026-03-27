-- =============================================================================
-- Hola Prime Admin Platform — Phase 4 Schema
-- Payment Gateways · SumSub KYC · SMTP · Notification Templates
-- =============================================================================

-- ── Payment gateway registry ───────────────────────────────────────────────────
CREATE TYPE gateway_name AS ENUM (
  'stripe', 'crypto_manual', 'nowpayments', 'coinbase_commerce',
  'skrill', 'neteller', 'bank_transfer',
  'flutterwave', 'razorpay', 'paypal'
);

CREATE TYPE gateway_status AS ENUM ('active','inactive','test_mode');

CREATE TABLE payment_gateways (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          gateway_name NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT,
  logo_url      TEXT,
  status        gateway_status NOT NULL DEFAULT 'inactive',
  config        JSONB NOT NULL DEFAULT '{}',   -- encrypted API keys etc
  supported_currencies TEXT[] NOT NULL DEFAULT '{"USD"}',
  min_amount    NUMERIC(15,2) NOT NULL DEFAULT 10,
  max_amount    NUMERIC(15,2),
  fee_pct       NUMERIC(6,4) NOT NULL DEFAULT 0,
  fee_fixed     NUMERIC(10,2) NOT NULL DEFAULT 0,
  countries_allowed TEXT[],                     -- NULL = all countries
  countries_blocked TEXT[] NOT NULL DEFAULT '{}',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed all gateways
INSERT INTO payment_gateways
  (name, display_name, description, status, supported_currencies, fee_pct, sort_order)
VALUES
  ('stripe',           'Credit / Debit Card',     'Visa, Mastercard, Amex via Stripe',              'inactive', '{"USD","EUR","GBP","AED","NGN"}', 2.9,   1),
  ('crypto_manual',    'Crypto (Manual)',          'USDT, BTC, ETH — manual wallet confirmation',    'inactive', '{"USD"}',                         0,     2),
  ('nowpayments',      'Crypto (NOWPayments)',     'Automatic crypto via NOWPayments',               'inactive', '{"USD"}',                         0.5,   3),
  ('coinbase_commerce','Crypto (Coinbase)',         'Crypto checkout via Coinbase Commerce',          'inactive', '{"USD"}',                         1.0,   4),
  ('skrill',           'Skrill',                   'Skrill digital wallet',                          'inactive', '{"USD","EUR","GBP"}',              1.45,  5),
  ('neteller',         'Neteller',                 'Neteller digital wallet',                        'inactive', '{"USD","EUR","GBP"}',              1.45,  6),
  ('bank_transfer',    'Bank Transfer / Wire',     'Manual bank wire — reviewed by finance team',    'inactive', '{"USD","EUR","GBP","AED"}',        0,     7),
  ('flutterwave',      'Flutterwave',              'Cards & mobile money for Africa (NGN, GHS, KES)','inactive', '{"NGN","GHS","KES","ZAR","USD"}',  1.4,   8),
  ('razorpay',         'Razorpay',                 'Cards, UPI, NetBanking for India (INR)',         'inactive', '{"INR"}',                          2.0,   9),
  ('paypal',           'PayPal',                   'PayPal checkout',                                'inactive', '{"USD","EUR","GBP"}',              3.49, 10)
ON CONFLICT (name) DO NOTHING;

-- Payment intent tracking (gateway-agnostic)
CREATE TABLE payment_intents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  product_id        UUID REFERENCES challenge_products(id),
  gateway           gateway_name NOT NULL,
  amount            NUMERIC(15,2) NOT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  amount_usd        NUMERIC(15,2) NOT NULL,           -- normalised to USD
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed','expired','refunded')),
  gateway_reference TEXT,                              -- Stripe PI id, Flutterwave tx ref, etc
  gateway_response  JSONB NOT NULL DEFAULT '{}',       -- raw response from gateway
  metadata          JSONB NOT NULL DEFAULT '{}',
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_intents_user   ON payment_intents(user_id, created_at DESC);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_ref    ON payment_intents(gateway_reference);

-- Crypto deposit tracking
CREATE TABLE crypto_deposits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id       UUID NOT NULL REFERENCES payment_intents(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  gateway         TEXT NOT NULL,
  coin            TEXT NOT NULL,                       -- USDT, BTC, ETH, etc
  network         TEXT NOT NULL,                       -- TRC20, ERC20, BEP20
  wallet_address  TEXT NOT NULL,
  expected_amount NUMERIC(20,8) NOT NULL,
  received_amount NUMERIC(20,8),
  tx_hash         TEXT,
  confirmations   INTEGER NOT NULL DEFAULT 0,
  is_confirmed    BOOLEAN NOT NULL DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crypto_deposits_intent  ON crypto_deposits(intent_id);
CREATE INDEX idx_crypto_deposits_address ON crypto_deposits(wallet_address);

-- Bank transfer references
CREATE TABLE bank_transfer_refs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id       UUID NOT NULL REFERENCES payment_intents(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  reference_code  TEXT NOT NULL UNIQUE,               -- unique ref user puts in memo
  bank_name       TEXT,
  account_name    TEXT,
  account_number  TEXT,
  iban            TEXT,
  swift           TEXT,
  routing_number  TEXT,
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  amount          NUMERIC(15,2) NOT NULL,
  is_confirmed    BOOLEAN NOT NULL DEFAULT false,
  confirmed_by    UUID REFERENCES admin_users(id),
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SumSub KYC ─────────────────────────────────────────────────────────────────
CREATE TABLE sumsub_applicants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) UNIQUE,
  applicant_id    TEXT NOT NULL UNIQUE,               -- SumSub applicantId
  level_name      TEXT NOT NULL DEFAULT 'basic-kyc-level',
  review_status   TEXT,                               -- init, pending, prechecked, queued, completed, onHold
  review_result   TEXT,                               -- GREEN, RED, ERROR
  reject_labels   TEXT[] NOT NULL DEFAULT '{}',
  moderation_comment TEXT,
  client_comment  TEXT,
  access_token    TEXT,                               -- short-lived SDK token
  access_token_expires_at TIMESTAMPTZ,
  webhook_payload JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sumsub_applicant_user ON sumsub_applicants(user_id);
CREATE INDEX idx_sumsub_applicant_id   ON sumsub_applicants(applicant_id);

-- ── SMTP configuration ──────────────────────────────────────────────────────────
CREATE TABLE smtp_configs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL,                          -- sendgrid, ses, mailgun, smtp2go, custom
  host        TEXT,
  port        INTEGER,
  username    TEXT,
  password    TEXT,                                   -- stored encrypted
  api_key     TEXT,                                   -- stored encrypted
  from_email  TEXT NOT NULL,
  from_name   TEXT NOT NULL DEFAULT 'Hola Prime',
  is_active   BOOLEAN NOT NULL DEFAULT false,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  last_test_at   TIMESTAMPTZ,
  last_test_ok   BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
