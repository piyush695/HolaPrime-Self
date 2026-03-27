-- =============================================================================
-- Hola Prime — Migration 007
-- Pixel / SDK Manager  ·  Extended S2S Integration Types
-- =============================================================================

-- ── Extend integration_type enum with new platforms ───────────────────────────
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'taboola';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'outbrain';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'snapchat';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'pinterest';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'linkedin';

-- ── Pixel / SDK registry ──────────────────────────────────────────────────────
-- Stores client-side tracking pixels/scripts injected into the trader app head.
-- No developer required — admin configures and the app loads them dynamically.

CREATE TABLE IF NOT EXISTS pixel_configs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,                    -- human label e.g. "Meta Pixel - Main"
  platform      TEXT NOT NULL,                    -- meta_pixel | gtm | tiktok_pixel | taboola_pixel |
                                                  -- outbrain_pixel | snapchat_pixel | pinterest_pixel |
                                                  -- linkedin_insight | google_ads | custom_script
  pixel_id      TEXT,                             -- the raw pixel/container ID
  extra_config  JSONB NOT NULL DEFAULT '{}',      -- platform-specific options (e.g. advanced matching fields)
  custom_script TEXT,                             -- for custom_script type — raw JS
  load_on       TEXT[] NOT NULL DEFAULT ARRAY['all'],  -- all | landing | dashboard | checkout
  is_active     BOOLEAN NOT NULL DEFAULT false,
  fire_on_events TEXT[] NOT NULL DEFAULT '{}',    -- internal event names to fire standard events for
  event_map     JSONB NOT NULL DEFAULT '{}',      -- internal_event -> pixel_event_name mapping
  created_by    UUID REFERENCES admin_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pixels_platform ON pixel_configs(platform, is_active);

-- ── Custom S2S event parameter definitions ────────────────────────────────────
-- Allows admins to define extra parameters per platform event, beyond the
-- standard fields already in S2SEventPayload.

CREATE TABLE IF NOT EXISTS s2s_event_params (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES s2s_integrations(id) ON DELETE CASCADE,
  internal_event  TEXT NOT NULL,                  -- e.g. 'payment.completed'
  external_event  TEXT NOT NULL,                  -- e.g. 'Purchase'
  params          JSONB NOT NULL DEFAULT '{}',    -- { "content_type": "product", "currency": "USD" }
  -- params can use template variables: {{value}}, {{email}}, {{productId}}, {{custom.field}}
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, internal_event)
);

CREATE INDEX IF NOT EXISTS idx_s2s_params_integration ON s2s_event_params(integration_id);

-- ── Pixel fire log (lightweight, last 500 per pixel) ─────────────────────────
CREATE TABLE IF NOT EXISTS pixel_fire_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pixel_id    UUID NOT NULL REFERENCES pixel_configs(id) ON DELETE CASCADE,
  event_name  TEXT NOT NULL,
  page        TEXT,
  user_id     UUID REFERENCES users(id),
  fired_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pixel_log_pixel ON pixel_fire_log(pixel_id, fired_at DESC);
