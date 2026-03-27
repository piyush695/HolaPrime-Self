import { query, queryOne } from '../../db/index.js';
import { getPlatformAdapter, SUPPORTED_PLATFORMS } from '../../platform/platform.service.js';
import type { PlatformType } from '../../platform/adapter.interface.js';

// ── Get all platform credential configs ───────────────────────────────────────
export async function listPlatformConfigs() {
  return query(`
    SELECT pc.*, a.email AS updated_by_email
    FROM platform_credentials pc
    LEFT JOIN admin_users a ON a.id = pc.updated_by
    ORDER BY pc.platform
  `);
}

// ── Get single platform config ────────────────────────────────────────────────
export async function getPlatformConfig(platform: string) {
  return queryOne(
    'SELECT * FROM platform_credentials WHERE platform = $1',
    [platform],
  );
}

// ── Save/update credentials ───────────────────────────────────────────────────
export async function savePlatformCredentials(
  platform: string,
  credentials: Record<string, string>,
  isActive: boolean,
  updatedBy: string,
) {
  await query(`
    INSERT INTO platform_credentials (platform, credentials, is_active, updated_by, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (platform) DO UPDATE
    SET credentials = $2, is_active = $3, updated_by = $4, updated_at = NOW()
  `, [platform, JSON.stringify(credentials), isActive, updatedBy]);

  // Clear adapter cache so it picks up new credentials
  const { clearAdapterCache } = await import('../../platform/platform.service.js');
  clearAdapterCache(platform as PlatformType);
}

// ── Test platform connection ──────────────────────────────────────────────────
export async function testPlatformConnection(platform: string): Promise<{
  ok: boolean;
  latencyMs: number | null;
  message?: string;
}> {
  try {
    const adapter = getPlatformAdapter(platform as PlatformType);
    const result  = await adapter.healthCheck();
    
    // Store test result
    await query(`
      UPDATE platform_credentials
      SET last_tested_at = NOW(), last_test_ok = $1, last_test_msg = $2
      WHERE platform = $3
    `, [result.connected, result.message ?? null, platform]);

    return {
      ok:        result.connected,
      latencyMs: result.latencyMs,
      message:   result.message,
    };
  } catch (err) {
    const msg = String(err);
    await query(`
      UPDATE platform_credentials
      SET last_tested_at = NOW(), last_test_ok = false, last_test_msg = $1
      WHERE platform = $2
    `, [msg.slice(0, 500), platform]);
    return { ok: false, latencyMs: null, message: msg };
  }
}

// ── Get all health statuses ───────────────────────────────────────────────────
export async function getAllPlatformHealth() {
  const configs = await query<{
    platform: string; is_active: boolean;
    last_tested_at: string; last_test_ok: boolean; last_test_msg: string;
  }>('SELECT platform, is_active, last_tested_at, last_test_ok, last_test_msg FROM platform_credentials');

  return configs.map(c => ({
    platform:    c.platform,
    isActive:    c.is_active,
    lastTested:  c.last_tested_at,
    lastTestOk:  c.last_test_ok,
    lastTestMsg: c.last_test_msg,
  }));
}
