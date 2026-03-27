-- =============================================================================
-- Hola Prime — Migration 006
-- Audit Logs · Role Permissions · Payout Timeline · Trading Sync
-- =============================================================================

-- ── Enhance existing admin_audit_log ─────────────────────────────────────────
ALTER TABLE admin_audit_log
  ADD COLUMN IF NOT EXISTS admin_email  TEXT,
  ADD COLUMN IF NOT EXISTS admin_role   TEXT,
  ADD COLUMN IF NOT EXISTS module       TEXT,
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS metadata     JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS user_agent   TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_module   ON admin_audit_log(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity   ON admin_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_admin_ts ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON admin_audit_log(created_at DESC);

-- ── Role Permission Matrix ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key            TEXT NOT NULL UNIQUE,
  module         TEXT NOT NULL,
  label          TEXT NOT NULL,
  description    TEXT,
  is_destructive BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role           TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted_by     UUID REFERENCES admin_users(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_perms ON role_permissions(role);

INSERT INTO permissions (key, module, label, description, is_destructive) VALUES
  ('users.view',        'users',        'View Users',           'View user list and profiles', false),
  ('users.edit',        'users',        'Edit Users',           'Edit user details', false),
  ('users.ban',         'users',        'Ban/Suspend Users',    'Ban or suspend user accounts', true),
  ('users.delete',      'users',        'Delete Users',         'Permanently delete users', true),
  ('kyc.view',          'kyc',          'View KYC',             'View KYC submissions', false),
  ('kyc.approve',       'kyc',          'Approve KYC',          'Approve KYC applications', false),
  ('kyc.reject',        'kyc',          'Reject KYC',           'Reject KYC applications', false),
  ('payments.view',     'payments',     'View Payments',        'View payment history', false),
  ('payments.refund',   'payments',     'Issue Refunds',        'Process payment refunds', true),
  ('payouts.view',      'payouts',      'View Payouts',         'View payout requests', false),
  ('payouts.approve',   'payouts',      'Approve Payouts',      'Approve payout requests', false),
  ('payouts.reject',    'payouts',      'Reject Payouts',       'Reject payout requests', false),
  ('payouts.batch',     'payouts',      'Batch Payout Actions', 'Approve/reject multiple payouts', false),
  ('accounts.view',     'accounts',     'View Accounts',        'View trading accounts', false),
  ('accounts.edit',     'accounts',     'Edit Accounts',        'Modify account settings', false),
  ('accounts.breach',   'accounts',     'Mark as Breached',     'Manually breach an account', true),
  ('accounts.reset',    'accounts',     'Reset Accounts',       'Reset account balance', true),
  ('risk.view',         'risk',         'View Risk',            'View risk dashboard', false),
  ('risk.override',     'risk',         'Risk Overrides',       'Override risk flags', true),
  ('reports.view',      'reports',      'View Reports',         'Access report data', false),
  ('reports.export',    'reports',      'Export Reports',       'Export to CSV/PDF', false),
  ('settings.view',     'settings',     'View Settings',        'View system settings', false),
  ('settings.edit',     'settings',     'Edit Settings',        'Modify system settings', true),
  ('integrations.view', 'integrations', 'View Integrations',   'View S2S integrations', false),
  ('integrations.edit', 'integrations', 'Edit Integrations',   'Edit S2S integrations', true),
  ('admin.view',        'admin',        'View Admins',          'View admin list', false),
  ('admin.manage',      'admin',        'Manage Admins',        'Create/edit/deactivate admins', true),
  ('roles.manage',      'admin',        'Manage Roles',         'Edit role permissions', true),
  ('audit.view',        'audit',        'View Audit Log',       'Access full audit trail', false),
  ('trading.view',      'trading',      'View Trading Data',    'View live trading sync data', false),
  ('trading.sync',      'trading',      'Trigger Sync',         'Manually trigger account sync', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key)
  SELECT 'superadmin', key FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_key)
  SELECT 'admin', key FROM permissions
  WHERE key NOT IN ('users.delete','roles.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_key)
  SELECT 'support', key FROM permissions
  WHERE module IN ('users','kyc','accounts','trading')
    AND key NOT IN ('users.delete','users.ban','accounts.breach','accounts.reset')
ON CONFLICT DO NOTHING;

-- ── Payout Timeline ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_id   UUID NOT NULL,
  status      TEXT NOT NULL,
  note        TEXT,
  actor_id    UUID REFERENCES admin_users(id),
  actor_email TEXT,
  actor_role  TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_timeline ON payout_timeline(payout_id, created_at ASC);

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS internal_note    TEXT,
  ADD COLUMN IF NOT EXISTS priority         TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS batch_id         UUID,
  ADD COLUMN IF NOT EXISTS processed_amount NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS fee_amount       NUMERIC(18,8) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payouts_status   ON payout_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_priority ON payout_requests(priority, status);
CREATE INDEX IF NOT EXISTS idx_payouts_batch    ON payout_requests(batch_id) WHERE batch_id IS NOT NULL;

-- ── Live Trading Positions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_positions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  ticket        TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  direction     TEXT NOT NULL,
  lots          NUMERIC(10,4) NOT NULL,
  open_price    NUMERIC(18,8) NOT NULL,
  current_price NUMERIC(18,8),
  sl            NUMERIC(18,8),
  tp            NUMERIC(18,8),
  commission    NUMERIC(10,4) DEFAULT 0,
  swap          NUMERIC(10,4) DEFAULT 0,
  floating_pl   NUMERIC(15,4),
  open_time     TIMESTAMPTZ NOT NULL,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_ticket  ON account_positions(account_id, ticket);
CREATE INDEX        IF NOT EXISTS idx_positions_account ON account_positions(account_id);

ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS sync_error      TEXT,
  ADD COLUMN IF NOT EXISTS sync_fail_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_positions  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS floating_pl     NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_pl        NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_pl_pct    NUMERIC(8,4)  DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_accounts_sync     ON trading_accounts(last_sync_at DESC) WHERE platform_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON trading_accounts(platform, status);
