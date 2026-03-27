-- =============================================================================
-- Hola Prime — Migration 008
-- Password Reset Tokens
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token       TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(password_reset_token)
  WHERE password_reset_token IS NOT NULL;
