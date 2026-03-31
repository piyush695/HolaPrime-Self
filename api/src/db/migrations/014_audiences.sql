-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 014: Audiences — Custom Uploads + Platform Cohorts
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Audience definitions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audiences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('custom_upload','platform_cohort','crm_segment')),
  -- For platform cohorts: which filter was used
  cohort_key    TEXT,       -- e.g. 'inactive_7d', 'breached_30d', 'funded_no_payout'
  cohort_params JSONB DEFAULT '{}',
  -- For custom uploads
  source_file   TEXT,       -- original filename
  -- Live count (updated on refresh)
  contact_count INTEGER NOT NULL DEFAULT 0,
  -- Status
  status        TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('building','ready','error')),
  error_msg     TEXT,
  -- Audit
  created_by    UUID REFERENCES admin_users(id),
  last_refreshed_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Individual contacts in an audience ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS audience_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id   UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
  -- Contact identity (at least one required)
  email         TEXT,
  phone         TEXT,       -- E.164 format for WhatsApp
  first_name    TEXT,
  last_name     TEXT,
  -- Linked platform user (if matched)
  user_id       UUID REFERENCES users(id),
  -- Template variable data (merged at send time)
  merge_data    JSONB NOT NULL DEFAULT '{}',
  -- Send status tracking per audience (for dedup)
  opted_out     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_contacts_audience ON audience_contacts(audience_id);
CREATE INDEX IF NOT EXISTS idx_audience_contacts_email    ON audience_contacts(email);
CREATE INDEX IF NOT EXISTS idx_audience_contacts_phone    ON audience_contacts(phone);

-- ── Link audiences to campaigns ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_audiences (
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  audience_id   UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY   (campaign_id, audience_id)
);

-- ── Add WhatsApp template ref to campaigns ────────────────────────────────────
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS wa_template_id UUID REFERENCES whatsapp_templates(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_count  INTEGER DEFAULT 0;

-- ── Pre-built cohort definitions (reference data) ─────────────────────────────
-- These are just labels — the actual queries run dynamically
