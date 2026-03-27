-- =============================================================================
-- Hola Prime Admin Platform — Full Database Schema v1.0
-- PostgreSQL 16
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for full-text search on names/emails

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE kyc_status AS ENUM ('not_submitted', 'pending', 'under_review', 'approved', 'rejected', 'expired');
CREATE TYPE kyc_doc_type AS ENUM ('passport', 'national_id', 'driving_licence', 'proof_of_address', 'selfie');
CREATE TYPE admin_role AS ENUM ('superadmin', 'admin', 'compliance', 'support', 'finance', 'risk');
CREATE TYPE challenge_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'breached', 'passed', 'failed', 'funded', 'suspended', 'closed');
CREATE TYPE account_phase AS ENUM ('evaluation', 'verification', 'funded');
CREATE TYPE breach_type AS ENUM ('daily_loss', 'max_drawdown', 'min_trading_days', 'prohibited_strategy');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed');
CREATE TYPE payment_type AS ENUM ('challenge_fee', 'payout', 'refund', 'adjustment');
CREATE TYPE payment_method AS ENUM ('card', 'crypto', 'bank_transfer', 'paypal', 'internal');
CREATE TYPE payout_status AS ENUM ('pending', 'approved', 'processing', 'paid', 'rejected', 'on_hold');
CREATE TYPE platform_type AS ENUM ('mt5', 'ctrader', 'matchtrader', 'ninjatrader', 'tradovate');
CREATE TYPE risk_event_type AS ENUM ('daily_loss_warning', 'daily_loss_breach', 'drawdown_warning', 'drawdown_breach', 'suspicious_activity', 'news_trading', 'prohibited_strategy');
CREATE TYPE affiliate_status AS ENUM ('pending', 'active', 'suspended', 'terminated');
CREATE TYPE commission_type AS ENUM ('flat', 'percentage', 'tiered');

-- =============================================================================
-- ADMIN USERS
-- =============================================================================

CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  role          admin_role NOT NULL DEFAULT 'support',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  mfa_secret    TEXT,
  mfa_enabled   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  refresh_token TEXT UNIQUE NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USERS (TRADERS)
-- =============================================================================

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            TEXT UNIQUE NOT NULL,
  email_verified   BOOLEAN NOT NULL DEFAULT false,
  password_hash    TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  phone            TEXT,
  country_code     CHAR(2),
  date_of_birth    DATE,
  status           user_status NOT NULL DEFAULT 'pending',
  kyc_status       kyc_status NOT NULL DEFAULT 'not_submitted',
  referral_code    TEXT UNIQUE DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
  referred_by      UUID REFERENCES users(id),
  affiliate_id     UUID,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_term         TEXT,
  utm_content      TEXT,
  first_touch_url  TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT UNIQUE NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- KYC
-- =============================================================================

CREATE TABLE kyc_submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          kyc_status NOT NULL DEFAULT 'pending',
  reviewer_id     UUID REFERENCES admin_users(id),
  rejection_reason TEXT,
  reviewed_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id   UUID NOT NULL REFERENCES kyc_submissions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type        kyc_doc_type NOT NULL,
  gcs_path        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  mime_type       TEXT NOT NULL,
  is_verified     BOOLEAN,
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CHALLENGE PRODUCTS
-- =============================================================================

CREATE TABLE challenge_products (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   TEXT NOT NULL,
  slug                   TEXT UNIQUE NOT NULL,
  description            TEXT,
  status                 challenge_status NOT NULL DEFAULT 'draft',
  account_size           NUMERIC(15,2) NOT NULL,
  fee                    NUMERIC(10,2) NOT NULL,
  currency               CHAR(3) NOT NULL DEFAULT 'USD',
  platform               platform_type NOT NULL DEFAULT 'mt5',
  phases                 JSONB NOT NULL DEFAULT '[]',
  -- Phase config example:
  -- [{"phase":"evaluation","profit_target":8,"max_daily_loss":4,"max_total_loss":8,"min_trading_days":4,"max_duration_days":30},
  --  {"phase":"verification","profit_target":5,"max_daily_loss":4,"max_total_loss":8,"min_trading_days":4,"max_duration_days":60}]
  leverage               TEXT NOT NULL DEFAULT '1:100',
  instruments_allowed    TEXT[] NOT NULL DEFAULT ARRAY['FOREX','GOLD','INDICES'],
  news_trading_allowed   BOOLEAN NOT NULL DEFAULT false,
  weekend_holding_allowed BOOLEAN NOT NULL DEFAULT false,
  scaling_plan           BOOLEAN NOT NULL DEFAULT false,
  profit_split           INTEGER NOT NULL DEFAULT 80,  -- percentage to trader
  payout_frequency       TEXT NOT NULL DEFAULT 'monthly',
  sort_order             INTEGER NOT NULL DEFAULT 0,
  metadata               JSONB NOT NULL DEFAULT '{}',
  created_by             UUID REFERENCES admin_users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TRADING ACCOUNTS (USER'S ACTIVE CHALLENGES)
-- =============================================================================

CREATE TABLE trading_accounts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id           UUID NOT NULL REFERENCES challenge_products(id),
  platform             platform_type NOT NULL,
  platform_account_id  TEXT,                          -- account login on MT5/cTrader/etc
  platform_password    TEXT,                          -- encrypted
  platform_server      TEXT,
  phase                account_phase NOT NULL DEFAULT 'evaluation',
  status               account_status NOT NULL DEFAULT 'pending',
  account_size         NUMERIC(15,2) NOT NULL,
  currency             CHAR(3) NOT NULL DEFAULT 'USD',
  starting_balance     NUMERIC(15,2) NOT NULL,
  current_balance      NUMERIC(15,2),
  current_equity       NUMERIC(15,2),
  profit_target        NUMERIC(8,4) NOT NULL,         -- percentage
  max_daily_loss       NUMERIC(8,4) NOT NULL,         -- percentage
  max_total_loss       NUMERIC(8,4) NOT NULL,         -- percentage
  min_trading_days     INTEGER NOT NULL DEFAULT 4,
  max_duration_days    INTEGER,
  days_traded          INTEGER NOT NULL DEFAULT 0,
  phase_started_at     TIMESTAMPTZ,
  phase_ends_at        TIMESTAMPTZ,
  breached_at          TIMESTAMPTZ,
  breach_type          breach_type,
  passed_at            TIMESTAMPTZ,
  funded_at            TIMESTAMPTZ,
  last_sync_at         TIMESTAMPTZ,
  payment_id           UUID,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  balance         NUMERIC(15,2) NOT NULL,
  equity          NUMERIC(15,2) NOT NULL,
  floating_pl     NUMERIC(15,2),
  daily_pl        NUMERIC(15,2),
  daily_pl_pct    NUMERIC(8,4),
  total_pl        NUMERIC(15,2),
  total_pl_pct    NUMERIC(8,4),
  open_lots       NUMERIC(10,4),
  trades_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, snapshot_date)
);

CREATE TABLE account_trades (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id       UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  platform_ticket  TEXT,
  symbol           TEXT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
  lots             NUMERIC(10,4) NOT NULL,
  open_price       NUMERIC(15,5),
  close_price      NUMERIC(15,5),
  sl               NUMERIC(15,5),
  tp               NUMERIC(15,5),
  commission       NUMERIC(10,4),
  swap             NUMERIC(10,4),
  profit           NUMERIC(15,2),
  open_time        TIMESTAMPTZ,
  close_time       TIMESTAMPTZ,
  is_open          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RISK EVENTS
-- =============================================================================

CREATE TABLE risk_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type      risk_event_type NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message         TEXT NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}',
  acknowledged_by UUID REFERENCES admin_users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PAYMENTS
-- =============================================================================

CREATE TABLE payments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type                 payment_type NOT NULL,
  status               payment_status NOT NULL DEFAULT 'pending',
  amount               NUMERIC(15,2) NOT NULL,
  currency             CHAR(3) NOT NULL DEFAULT 'USD',
  method               payment_method NOT NULL,
  provider             TEXT,
  provider_reference   TEXT,
  provider_response    JSONB,
  description          TEXT,
  account_id           UUID REFERENCES trading_accounts(id),
  processed_by         UUID REFERENCES admin_users(id),
  processed_at         TIMESTAMPTZ,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payout_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_id        UUID NOT NULL REFERENCES trading_accounts(id),
  payment_id        UUID REFERENCES payments(id),
  status            payout_status NOT NULL DEFAULT 'pending',
  amount            NUMERIC(15,2) NOT NULL,
  profit_split_pct  INTEGER NOT NULL DEFAULT 80,
  trader_amount     NUMERIC(15,2) NOT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  withdrawal_method TEXT NOT NULL,
  withdrawal_details JSONB NOT NULL DEFAULT '{}',  -- encrypted bank/crypto details
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  reviewed_by       UUID REFERENCES admin_users(id),
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AFFILIATES
-- =============================================================================

CREATE TABLE affiliates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id),
  email             TEXT UNIQUE NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  company           TEXT,
  status            affiliate_status NOT NULL DEFAULT 'pending',
  code              TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 10)),
  commission_type   commission_type NOT NULL DEFAULT 'percentage',
  commission_value  NUMERIC(10,4) NOT NULL DEFAULT 20,  -- % or flat amount
  total_referrals   INTEGER NOT NULL DEFAULT 0,
  total_earned      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_paid        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  approved_by       UUID REFERENCES admin_users(id),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE affiliate_clicks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id   UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  ip_address     INET,
  user_agent     TEXT,
  landing_page   TEXT,
  referrer       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE affiliate_conversions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id    UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES payments(id),
  commission      NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CRM / MARTECH (Phase 2 — structure only, populated later)
-- =============================================================================

CREATE TABLE crm_leads (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          TEXT NOT NULL,
  first_name     TEXT,
  last_name      TEXT,
  phone          TEXT,
  country_code   CHAR(2),
  source         TEXT,
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
  assigned_to    UUID REFERENCES admin_users(id),
  user_id        UUID REFERENCES users(id),
  notes          TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  subject     TEXT NOT NULL,
  html_body   TEXT NOT NULL,
  text_body   TEXT,
  variables   TEXT[] NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE campaigns (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('email', 'whatsapp', 'sms', 'push')),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled')),
  template_id      UUID REFERENCES email_templates(id),
  segment_query    JSONB,
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  sent_count       INTEGER NOT NULL DEFAULT 0,
  open_count       INTEGER NOT NULL DEFAULT 0,
  click_count      INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES admin_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TOURNAMENTS (Phase 3 — structure ready)
-- =============================================================================

CREATE TABLE tournaments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','registration','phase1','phase2','bracket','completed','cancelled')),
  entry_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
  prize_pool      NUMERIC(15,2) NOT NULL DEFAULT 0,
  max_countries   INTEGER NOT NULL DEFAULT 64,
  phase1_start    TIMESTAMPTZ,
  phase1_end      TIMESTAMPTZ,
  phase2_start    TIMESTAMPTZ,
  phase2_end      TIMESTAMPTZ,
  bracket_start   TIMESTAMPTZ,
  final_end       TIMESTAMPTZ,
  rules           JSONB NOT NULL DEFAULT '{}',
  prizes          JSONB NOT NULL DEFAULT '[]',
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournament_entries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id    UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES trading_accounts(id),
  country_code     CHAR(2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','fee_paid','phase1','phase2','bracket','eliminated','champion')),
  phase1_return    NUMERIC(10,4),
  phase1_rank      INTEGER,
  phase2_return    NUMERIC(10,4),
  phase2_rank      INTEGER,
  global_rank      INTEGER,
  is_country_champion BOOLEAN NOT NULL DEFAULT false,
  bracket_seed     INTEGER,
  prize_amount     NUMERIC(15,2),
  prize_paid       BOOLEAN NOT NULL DEFAULT false,
  payment_id       UUID REFERENCES payments(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, user_id)
);

-- =============================================================================
-- PLATFORM CONNECTIONS (trading platform account registry)
-- =============================================================================

CREATE TABLE platform_connections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform          platform_type NOT NULL,
  environment       TEXT NOT NULL CHECK (environment IN ('live', 'demo')),
  name              TEXT NOT NULL,
  api_url           TEXT NOT NULL,
  credentials       JSONB NOT NULL DEFAULT '{}',  -- encrypted
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_health_at    TIMESTAMPTZ,
  health_status     TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')),
  created_by        UUID REFERENCES admin_users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_country ON users(country_code);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_email_trgm ON users USING GIN (email gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON users USING GIN ((first_name || ' ' || last_name) gin_trgm_ops);

-- Trading accounts
CREATE INDEX idx_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX idx_accounts_status ON trading_accounts(status);
CREATE INDEX idx_accounts_platform ON trading_accounts(platform);
CREATE INDEX idx_accounts_phase ON trading_accounts(phase);
CREATE INDEX idx_accounts_created_at ON trading_accounts(created_at DESC);

-- Payments
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(type);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Risk events
CREATE INDEX idx_risk_account_id ON risk_events(account_id);
CREATE INDEX idx_risk_user_id ON risk_events(user_id);
CREATE INDEX idx_risk_event_type ON risk_events(event_type);
CREATE INDEX idx_risk_created_at ON risk_events(created_at DESC);
CREATE INDEX idx_risk_unacknowledged ON risk_events(created_at DESC) WHERE acknowledged_at IS NULL;

-- Snapshots
CREATE INDEX idx_snapshots_account_date ON account_snapshots(account_id, snapshot_date DESC);

-- Audit log
CREATE INDEX idx_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON admin_audit_log(created_at DESC);

-- Affiliates
CREATE INDEX idx_affiliate_code ON affiliates(code);
CREATE INDEX idx_affiliate_conversions ON affiliate_conversions(affiliate_id, created_at DESC);

-- =============================================================================
-- SEED: Default superadmin (password: Admin@HolaPrime1 — CHANGE IMMEDIATELY)
-- bcrypt hash of "Admin@HolaPrime1" with 12 rounds
-- =============================================================================

-- Admin user is created by running: npm run seed
-- (or npm run setup which runs migrate + seed together)
