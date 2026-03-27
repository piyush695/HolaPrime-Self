-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 012 — Marketing: UTM Links, Click Tracking, Campaign Analytics
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── UTM Link Builder ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utm_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                        -- internal label
  destination_url TEXT NOT NULL,
  utm_source      TEXT NOT NULL,
  utm_medium      TEXT NOT NULL,
  utm_campaign    TEXT NOT NULL,
  utm_term        TEXT,
  utm_content     TEXT,
  utm_id          TEXT,                                 -- custom ID param
  custom_params   JSONB DEFAULT '{}',                   -- any extra params
  short_code      TEXT UNIQUE,                          -- for short URL /go/xyz
  total_clicks    INTEGER NOT NULL DEFAULT 0,
  unique_clicks   INTEGER NOT NULL DEFAULT 0,
  conversions     INTEGER NOT NULL DEFAULT 0,
  revenue         NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  tags            JSONB DEFAULT '[]',
  notes           TEXT,
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Click ID tracking ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id        TEXT UNIQUE NOT NULL,                 -- our generated ID (hp_xxxxxxxx)
  -- Ad platform click IDs
  gclid           TEXT,                                 -- Google
  fbclid          TEXT,                                 -- Meta/Facebook
  ttclid          TEXT,                                 -- TikTok
  twclid          TEXT,                                 -- Twitter/X
  msclkid         TEXT,                                 -- Microsoft/Bing
  li_fat_id       TEXT,                                 -- LinkedIn
  pin_uniq        TEXT,                                 -- Pinterest
  snapchat_id     TEXT,                                 -- Snapchat
  -- UTM params
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_term        TEXT,
  utm_content     TEXT,
  utm_id          TEXT,
  -- Attribution
  landing_url     TEXT,
  referrer        TEXT,
  channel         TEXT,                                 -- derived: google_ads | meta_ads | tiktok | etc
  device_type     TEXT,
  country_code    CHAR(2),
  ip_address      INET,
  user_agent      TEXT,
  -- Conversion tracking
  user_id         UUID REFERENCES users(id),            -- set when visitor registers
  converted_at    TIMESTAMPTZ,
  conversion_event TEXT,                                -- signup | purchase | kyc_completed
  conversion_value NUMERIC(12,2),
  -- Link ref
  utm_link_id     UUID REFERENCES utm_links(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_gclid   ON ad_clicks(gclid)   WHERE gclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_clicks_fbclid  ON ad_clicks(fbclid)  WHERE fbclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ttclid  ON ad_clicks(ttclid)  WHERE ttclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_clicks_channel ON ad_clicks(channel, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_user    ON ad_clicks(user_id)  WHERE user_id IS NOT NULL;

-- ── Add click_id to users table ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_click_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_click_id  TEXT;

-- ── Add clickid columns to attribution_events ─────────────────────────────────
ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS click_id    TEXT;
ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS msclkid     TEXT;
ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS twclid      TEXT;
ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS li_fat_id   TEXT;
ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS utm_id      TEXT;
ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS custom_params JSONB DEFAULT '{}';

-- ── Marketing campaigns table (for tracking ad spend vs revenue) ──────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  platform        TEXT NOT NULL,                        -- google | meta | tiktok | email | organic | other
  utm_campaign    TEXT,                                 -- links to utm_campaign param
  budget          NUMERIC(12,2),
  spend           NUMERIC(12,2) DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  conversions     INTEGER DEFAULT 0,
  revenue         NUMERIC(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',       -- active | paused | ended
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
