import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '../../db/index.js';

export interface AdminUser {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; mfaEnabled: boolean;
}
export interface LoginResult {
  admin: AdminUser; accessToken: string; refreshToken: string;
}

export async function loginAdmin(
  email: string,
  password: string,
  ip: string,
  userAgent: string,
  signFn: (payload: Record<string, unknown>) => string,
): Promise<LoginResult> {

  // 1. Fetch admin
  const admin = await queryOne<{
    id: string; email: string; password_hash: string;
    first_name: string; last_name: string; role: string;
    is_active: boolean; mfa_enabled: boolean;
  }>('SELECT id,email,password_hash,first_name,last_name,role,is_active,mfa_enabled FROM admin_users WHERE email = $1',
    [email.toLowerCase().trim()]);

  if (!admin) {
    const e: any = new Error('Invalid email or password'); e.statusCode = 401; throw e;
  }
  if (!admin.is_active) {
    const e: any = new Error('Account disabled'); e.statusCode = 403; throw e;
  }

  // 2. Verify password
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    const e: any = new Error('Invalid email or password'); e.statusCode = 401; throw e;
  }

  // 3. Sign tokens — embed exp in payload to avoid options API differences
  const now = Math.floor(Date.now() / 1000);
  const accessToken  = signFn({ sub: admin.id, role: admin.role, type: 'admin',  iat: now, exp: now + 900 });       // 15 min
  const refreshToken = signFn({ sub: admin.id, type: 'refresh',                  iat: now, exp: now + 604800 });    // 7 days

  // 4. Record session (non-blocking)
  const safeIp = ip && ip.length <= 45 && ip !== '::1' ? ip : '127.0.0.1';
  withTransaction(async (client) => {
    await client.query('UPDATE admin_users SET last_login_at=NOW() WHERE id=$1', [admin.id]);
    await client.query(
      `INSERT INTO admin_sessions(admin_id,refresh_token,ip_address,user_agent,expires_at)
       VALUES($1,$2,$3::inet,$4,NOW()+INTERVAL '7 days')`,
      [admin.id, refreshToken, safeIp, (userAgent||'').slice(0,500)],
    );
  }).catch(err => console.error('[auth] session record failed:', err.message));

  return {
    admin: {
      id: admin.id, email: admin.email,
      firstName: admin.first_name, lastName: admin.last_name,
      role: admin.role, isActive: admin.is_active, mfaEnabled: admin.mfa_enabled,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  signFn: (payload: Record<string, unknown>) => string,
): Promise<string> {
  const session = await queryOne<{ admin_id: string; expires_at: string; revoked_at: string | null }>(
    'SELECT admin_id,expires_at,revoked_at FROM admin_sessions WHERE refresh_token=$1', [refreshToken],
  );
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    const e: any = new Error('Invalid or expired refresh token'); e.statusCode = 401; throw e;
  }
  const admin = await queryOne<{ role: string; is_active: boolean }>(
    'SELECT role,is_active FROM admin_users WHERE id=$1', [session.admin_id],
  );
  if (!admin || !admin.is_active) {
    const e: any = new Error('Account disabled'); e.statusCode = 403; throw e;
  }
  const now = Math.floor(Date.now() / 1000);
  return signFn({ sub: session.admin_id, role: admin.role, type: 'admin', iat: now, exp: now + 900 });
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await query('UPDATE admin_sessions SET revoked_at=NOW() WHERE refresh_token=$1', [refreshToken]);
}
