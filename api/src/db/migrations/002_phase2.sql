-- =============================================================================
-- Hola Prime Admin Platform — Phase 2 Schema
-- CRM · Affiliates · Attribution · Campaigns · WhatsApp · Retention
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE lead_status     AS ENUM ('new','contacted','qualified','demo_scheduled','converted','lost','unsubscribed');
CREATE TYPE lead_source     AS ENUM ('organic','paid_search','paid_social','affiliate','referral','direct','email','whatsapp','partner','unknown');
CREATE TYPE activity_type   AS ENUM ('note','call','email_sent','whatsapp_sent','status_change','kyc_update','account_created','payment','login','page_view');
CREATE TYPE campaign_type   AS ENUM ('email','whatsapp','sms','push');
CREATE TYPE campaign_status AS ENUM ('draft','scheduled','running','paused','completed','cancelled');
CREATE TYPE channel_type    AS ENUM ('google_ads','meta_ads','tiktok_ads','google_analytics','meta_pixel','tiktok_pixel','webhook','api');
CREATE TYPE touchpoint_type AS ENUM ('first','last','assisted');
CREATE TYPE commission_event AS ENUM ('registration','kyc_approved','challenge_purchase','funded_account','payout');

-- =============================================================================
-- CRM — LEADS & CONTACTS
-- =============================================================================

CREATE TABLE crm_contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),           -- linked once they register
  email           TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  country_code    CHAR(2),
  language        TEXT DEFAULT 'en',
  status          lead_status NOT NULL DEFAULT 'new',
  source          lead_source NOT NULL DEFAULT 'unknown',
  score           INTEGER NOT NULL DEFAULT 0,           -- 0-100 lead score
  assigned_to     UUID REFERENCES admin_users(id),
  -- Attribution snapshot at acquisition
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_term        TEXT,
  utm_content     TEXT,
  first_touch_url TEXT,
  last_touch_url  TEXT,
  referrer        TEXT,
  affiliate_id    UUID,
  -- Lifecycle timestamps
  converted_at    TIMESTAMPTZ,                          -- became a user
  last_activity_at TIMESTAMPTZ,
  -- Segmentation tags
  tags            TEXT[] NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email)
);

CREATE TABLE crm_activities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id   UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id),
  admin_id     UUID REFERENCES admin_users(id),
  type         activity_type NOT NULL,
  subject      TEXT,
  body         TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id   UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES admin_users(id),
  body         TEXT NOT NULL,
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_segments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT,
  query        JSONB NOT NULL,    -- filter definition
  is_dynamic   BOOLEAN NOT NULL DEFAULT true,
  last_count   INTEGER,
  last_run_at  TIMESTAMPTZ,
  created_by   UUID REFERENCES admin_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ATTRIBUTION ENGINE
-- =============================================================================

CREATE TABLE attribution_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_id  TEXT,                                   -- pre-registration
  user_id       UUID REFERENCES users(id),
  contact_id    UUID REFERENCES crm_contacts(id),
  session_id    TEXT,
  event_name    TEXT NOT NULL,                          -- 'page_view','signup','purchase' etc
  page_url      TEXT,
  referrer      TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  gclid         TEXT,                                   -- Google Click ID
  fbclid        TEXT,                                   -- Meta Click ID
  ttclid        TEXT,                                   -- TikTok Click ID
  channel       TEXT,                                   -- derived channel bucket
  device_type   TEXT,
  country_code  CHAR(2),
  ip_address    INET,
  metadata      JSONB NOT NULL DEFAULT '{}',
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attribution_touchpoints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            touchpoint_type NOT NULL,
  channel         TEXT NOT NULL,
  source          TEXT,
  medium          TEXT,
  campaign        TEXT,
  utm_term        TEXT,
  utm_content     TEXT,
  page_url        TEXT,
  referrer        TEXT,
  credit          NUMERIC(5,4) NOT NULL DEFAULT 1.0,    -- 0-1 for multi-touch models
  conversion_event TEXT,                                -- what this touchpoint contributed to
  revenue_attributed NUMERIC(15,2),
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE channel_integrations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  type         channel_type NOT NULL,
  config       JSONB NOT NULL DEFAULT '{}',             -- API keys, pixel IDs etc (encrypted)
  is_active    BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_by   UUID REFERENCES admin_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AFFILIATES (extended from Phase 1 stub)
-- =============================================================================

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS tier          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cookie_days   INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sub_affiliate_of UUID REFERENCES affiliates(id),
  ADD COLUMN IF NOT EXISTS payment_method  TEXT DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tracking_url    TEXT,
  ADD COLUMN IF NOT EXISTS custom_commission JSONB DEFAULT '{}';

CREATE TABLE affiliate_links (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id   UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  utm_source     TEXT DEFAULT 'affiliate',
  utm_medium     TEXT DEFAULT 'referral',
  utm_campaign   TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  clicks         INTEGER NOT NULL DEFAULT 0,
  conversions    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slug)
);

CREATE TABLE affiliate_commission_rules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id     UUID REFERENCES affiliates(id),     -- NULL = global default
  event            commission_event NOT NULL,
  type             commission_type NOT NULL DEFAULT 'percentage',
  value            NUMERIC(10,4) NOT NULL,
  min_deposit      NUMERIC(15,2),
  max_per_referral NUMERIC(15,2),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE affiliate_payouts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id   UUID NOT NULL REFERENCES affiliates(id),
  amount         NUMERIC(15,2) NOT NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  method         TEXT,
  reference      TEXT,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  reviewed_by    UUID REFERENCES admin_users(id),
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EMAIL CAMPAIGNS (extended)
-- =============================================================================

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS category       TEXT DEFAULT 'transactional',
  ADD COLUMN IF NOT EXISTS preview_text   TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url  TEXT,
  ADD COLUMN IF NOT EXISTS version        INTEGER NOT NULL DEFAULT 1;

CREATE TABLE campaign_sends (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES crm_contacts(id),
  user_id       UUID REFERENCES users(id),
  email         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','unsubscribed','spam')),
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  provider_id   TEXT,                                   -- SendGrid message ID
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_unsubscribes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  reason      TEXT,
  list_type   TEXT DEFAULT 'all',                       -- 'all','marketing','product' etc
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, list_type)
);

-- =============================================================================
-- WHATSAPP (Meta Cloud API)
-- =============================================================================

CREATE TABLE whatsapp_templates (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  wa_template_name   TEXT NOT NULL,                     -- must match approved template name on Meta
  wa_template_id     TEXT,
  language           TEXT NOT NULL DEFAULT 'en_US',
  category           TEXT NOT NULL DEFAULT 'MARKETING', -- MARKETING | UTILITY | AUTHENTICATION
  status             TEXT NOT NULL DEFAULT 'draft'  CHECK (status IN ('draft','pending_approval','approved','rejected')),
  header_type        TEXT,                              -- TEXT | IMAGE | DOCUMENT | VIDEO
  header_content     TEXT,
  body_text          TEXT NOT NULL,
  footer_text        TEXT,
  buttons            JSONB NOT NULL DEFAULT '[]',
  variables          TEXT[] NOT NULL DEFAULT '{}',
  created_by         UUID REFERENCES admin_users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id     UUID REFERENCES campaigns(id),
  contact_id      UUID REFERENCES crm_contacts(id),
  user_id         UUID REFERENCES users(id),
  phone           TEXT NOT NULL,
  template_id     UUID REFERENCES whatsapp_templates(id),
  direction       TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed','rejected')),
  wa_message_id   TEXT,
  body            TEXT,
  variables_used  JSONB NOT NULL DEFAULT '{}',
  error_code      TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES crm_contacts(id),
  user_id         UUID REFERENCES users(id),
  phone           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','pending')),
  assigned_to     UUID REFERENCES admin_users(id),
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RETENTION ANALYTICS
-- =============================================================================

CREATE TABLE retention_cohorts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_month    CHAR(7) NOT NULL,           -- 'YYYY-MM'
  cohort_size     INTEGER NOT NULL,
  period_0        INTEGER,                    -- users active in signup month
  period_1        INTEGER,                    -- 1 month later
  period_2        INTEGER,
  period_3        INTEGER,
  period_6        INTEGER,
  period_12       INTEGER,
  metric          TEXT NOT NULL DEFAULT 'active_account',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_month, metric)
);

CREATE TABLE user_lifecycle_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  event       TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- CRM
CREATE INDEX idx_contacts_email      ON crm_contacts(email);
CREATE INDEX idx_contacts_status     ON crm_contacts(status);
CREATE INDEX idx_contacts_source     ON crm_contacts(source);
CREATE INDEX idx_contacts_assigned   ON crm_contacts(assigned_to);
CREATE INDEX idx_contacts_score      ON crm_contacts(score DESC);
CREATE INDEX idx_contacts_created    ON crm_contacts(created_at DESC);
CREATE INDEX idx_activities_contact  ON crm_activities(contact_id, created_at DESC);

-- Attribution
CREATE INDEX idx_attr_events_user    ON attribution_events(user_id, ts DESC);
CREATE INDEX idx_attr_events_anon    ON attribution_events(anonymous_id, ts DESC);
CREATE INDEX idx_attr_events_ts      ON attribution_events(ts DESC);
CREATE INDEX idx_attr_touchpoints    ON attribution_touchpoints(user_id, ts DESC);

-- Affiliates
CREATE INDEX idx_aff_link_slug       ON affiliate_links(slug);
CREATE INDEX idx_aff_clicks          ON affiliate_clicks(affiliate_id, created_at DESC);
CREATE INDEX idx_aff_conversions_aff ON affiliate_conversions(affiliate_id, created_at DESC);

-- Campaigns
CREATE INDEX idx_sends_campaign      ON campaign_sends(campaign_id, created_at DESC);
CREATE INDEX idx_sends_email         ON campaign_sends(email);
CREATE INDEX idx_sends_status        ON campaign_sends(status);

-- WhatsApp
CREATE INDEX idx_wa_messages_phone   ON whatsapp_messages(phone, created_at DESC);
CREATE INDEX idx_wa_messages_status  ON whatsapp_messages(status);
CREATE INDEX idx_wa_conv_phone       ON whatsapp_conversations(phone);

-- Retention
CREATE INDEX idx_lifecycle_user      ON user_lifecycle_events(user_id, ts DESC);
CREATE INDEX idx_lifecycle_event     ON user_lifecycle_events(event, ts DESC);
