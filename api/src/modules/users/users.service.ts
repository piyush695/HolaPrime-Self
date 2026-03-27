// ── Users Service ─────────────────────────────────────────────────────────────
import { query, queryOne } from '../../db/index.js';

export interface UserListParams {
  page:      number;
  limit:     number;
  search?:   string;
  status?:   string;
  kycStatus?: string;
  country?:  string;
  from?:     string;
  to?:       string;
}

export async function listUsers(params: UserListParams) {
  const { page, limit, search, status, kycStatus, country, from, to } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const values: unknown[]    = [];
  let   idx = 1;

  if (search) {
    conditions.push(`(
      email ILIKE $${idx} OR
      (first_name || ' ' || last_name) ILIKE $${idx} OR
      phone ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx++;
  }
  if (status)    { conditions.push(`status = $${idx++}`);     values.push(status); }
  if (kycStatus) { conditions.push(`kyc_status = $${idx++}`); values.push(kycStatus); }
  if (country)   { conditions.push(`country_code = $${idx++}`); values.push(country); }
  if (from)      { conditions.push(`created_at >= $${idx++}`); values.push(from); }
  if (to)        { conditions.push(`created_at <= $${idx++}`); values.push(to); }

  const where = conditions.join(' AND ');

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM users WHERE ${where}`, values,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const users = await query(
    `SELECT
      id, email, email_verified, first_name, last_name, phone,
      country_code, date_of_birth, status, kyc_status,
      referral_code, utm_source, utm_medium, utm_campaign,
      created_at, updated_at
     FROM users
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return {
    users,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function getUserById(id: string) {
  const user = await queryOne(
    `SELECT u.*,
       (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.user_id = u.id) AS account_count,
       (SELECT COUNT(*) FROM payments p WHERE p.user_id = u.id AND p.status = 'completed') AS payment_count,
       (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.user_id = u.id AND p.type = 'payout' AND p.status = 'completed') AS total_paid_out
     FROM users u WHERE u.id = $1`,
    [id],
  );
  return user;
}

export async function updateUserStatus(userId: string, status: string, adminId: string) {
  await query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, userId],
  );
  await query(
    `INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, new_data)
     VALUES ($1, 'user.status_changed', 'user', $2, $3)`,
    [adminId, userId, JSON.stringify({ status })],
  );
}

export async function getUserStats() {
  const [stats] = await query<{
    total: string; active: string; pending: string;
    suspended: string; kyc_approved: string; kyc_pending: string;
    new_today: string; new_this_month: string;
  }>(`
    SELECT
      COUNT(*)                                                          AS total,
      COUNT(*) FILTER (WHERE status = 'active')                        AS active,
      COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
      COUNT(*) FILTER (WHERE status = 'suspended')                     AS suspended,
      COUNT(*) FILTER (WHERE kyc_status = 'approved')                  AS kyc_approved,
      COUNT(*) FILTER (WHERE kyc_status = 'pending')                   AS kyc_pending,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)               AS new_today,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) AS new_this_month
    FROM users
  `);
  return stats;
}
