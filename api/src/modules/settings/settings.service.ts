import { query, queryOne, withTransaction } from '../../db/index.js';
import { checkAllPlatformHealth } from '../../platform/platform.service.js';

// ── Settings CRUD ─────────────────────────────────────────────────────────────
export async function getAllSettings(publicOnly = false) {
  const where = publicOnly ? 'WHERE is_public = true' : '';
  const rows = await query<{ key: string; value: unknown; description: string; is_public: boolean; updated_at: string }>(
    `SELECT key, value, description, is_public, updated_at FROM settings ${where} ORDER BY key`,
  );
  // Return as flat object for easy consumption
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = (r.value as any);
  return { settings: out, rows };
}

export async function getSetting(key: string): Promise<unknown> {
  const row = await queryOne<{ value: unknown }>('SELECT value FROM settings WHERE key = $1', [key]);
  return row?.value ?? null;
}

export async function upsertSetting(key: string, value: unknown, adminId: string): Promise<void> {
  await query(`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = $2, updated_by = $3, updated_at = NOW()
  `, [key, JSON.stringify(value), adminId]);

  await query(`
    INSERT INTO admin_audit_log (admin_id, action, entity_type, new_data)
    VALUES ($1, 'setting.updated', 'setting', $2)
  `, [adminId, JSON.stringify({ key, value })]);
}

export async function bulkUpsertSettings(
  settings: Record<string, unknown>,
  adminId: string,
): Promise<void> {
  await withTransaction(async (client) => {
    for (const [key, value] of Object.entries(settings)) {
      await client.query(`
        INSERT INTO settings (key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = $2, updated_by = $3, updated_at = NOW()
      `, [key, JSON.stringify(value), adminId]);
    }
  });
}

// ── Admin user management ─────────────────────────────────────────────────────
export async function listAdminUsers() {
  return query(`
    SELECT id, email, first_name, last_name, role, is_active,
           last_login_at, mfa_enabled, created_at
    FROM admin_users ORDER BY created_at ASC
  `);
}

export async function createAdminUser(data: {
  email: string; firstName: string; lastName: string;
  role: string; password: string;
}, creatorId: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  const hash   = await bcrypt.default.hash(data.password, 12);

  const [u] = await query<{ id: string }>(`
    INSERT INTO admin_users (email, password_hash, first_name, last_name, role)
    VALUES ($1,$2,$3,$4,$5) RETURNING id
  `, [data.email.toLowerCase(), hash, data.firstName, data.lastName, data.role]);

  await query(`
    INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id)
    VALUES ($1,'admin_user.created','admin_user',$2)
  `, [creatorId, u.id]);

  return u.id;
}

export async function updateAdminUser(
  id: string,
  data: { role?: string; isActive?: boolean; firstName?: string; lastName?: string },
  updaterId: string,
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (data.role      !== undefined) { sets.push(`role = $${i++}`);       vals.push(data.role); }
  if (data.isActive  !== undefined) { sets.push(`is_active = $${i++}`);  vals.push(data.isActive); }
  if (data.firstName !== undefined) { sets.push(`first_name = $${i++}`); vals.push(data.firstName); }
  if (data.lastName  !== undefined) { sets.push(`last_name = $${i++}`);  vals.push(data.lastName); }

  if (sets.length === 0) return;
  sets.push(`updated_at = NOW()`);

  await query(
    `UPDATE admin_users SET ${sets.join(', ')} WHERE id = $${i}`,
    [...vals, id],
  );

  await query(`
    INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, new_data)
    VALUES ($1,'admin_user.updated','admin_user',$2,$3)
  `, [updaterId, id, JSON.stringify(data)]);
}

export async function resetAdminPassword(
  id: string, newPassword: string, updaterId: string,
): Promise<void> {
  const bcrypt = await import('bcryptjs');
  const hash   = await bcrypt.default.hash(newPassword, 12);
  await query('UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);
  await query(`
    INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id)
    VALUES ($1,'admin_user.password_reset','admin_user',$2)
  `, [updaterId, id]);
}

// ── Platform health ────────────────────────────────────────────────────────────
export async function getPlatformHealth() {
  const health = await checkAllPlatformHealth();
  const connections = await query(
    'SELECT * FROM platform_connections ORDER BY platform, environment',
  );
  return { health, connections };
}

// ── Audit log ─────────────────────────────────────────────────────────────────
export async function getAuditLog(params: { page: number; limit: number; adminId?: string }) {
  const { page, limit, adminId } = params;
  const offset = (page - 1) * limit;
  const where  = adminId ? 'WHERE al.admin_id = $1' : '';
  const vals   = adminId ? [adminId] : [];

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM admin_audit_log al ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const logs = await query(`
    SELECT al.*, a.first_name, a.last_name, a.email
    FROM admin_audit_log al
    LEFT JOIN admin_users a ON a.id = al.admin_id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
  `, [...vals, limit, offset]);

  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
}
