// ── Payments Service ──────────────────────────────────────────────────────────
import { query, queryOne, withTransaction } from '../../db/index.js';
import { fireEvent } from '../integrations/event-bus.js';

export async function listPayments(params: {
  page: number; limit: number;
  userId?: string; status?: string;
  type?: string; from?: string; to?: string;
}) {
  const { page, limit, userId, status, type, from, to } = params;
  const offset = (page - 1) * limit;
  const conds: string[]  = ['1=1'];
  const vals: unknown[]  = [];
  let   i = 1;

  if (userId) { conds.push(`p.user_id = $${i++}`); vals.push(userId); }
  if (status) { conds.push(`p.status = $${i++}`);  vals.push(status); }
  if (type)   { conds.push(`p.type = $${i++}`);    vals.push(type); }
  if (from)   { conds.push(`p.created_at >= $${i++}`); vals.push(from); }
  if (to)     { conds.push(`p.created_at <= $${i++}`); vals.push(to); }

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM payments p WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const payments = await query(`
    SELECT p.*, u.email, u.first_name, u.last_name,
           a.first_name AS admin_first, a.last_name AS admin_last
    FROM payments p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN admin_users a ON a.id = p.processed_by
    WHERE ${where}
    ORDER BY p.created_at DESC
    LIMIT $${i} OFFSET $${i+1}
  `, [...vals, limit, offset]);

  return { payments, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getPaymentStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')                    AS pending_count,
      COUNT(*) FILTER (WHERE status = 'completed')                  AS completed_count,
      COALESCE(SUM(amount) FILTER (WHERE status='completed' AND type='challenge_fee'), 0) AS total_revenue,
      COALESCE(SUM(amount) FILTER (WHERE status='completed' AND type='payout'), 0)        AS total_payouts,
      COALESCE(SUM(amount) FILTER (WHERE status='completed' AND created_at >= DATE_TRUNC('month', NOW())), 0) AS revenue_this_month,
      COUNT(*) FILTER (WHERE status='completed' AND created_at >= DATE_TRUNC('month', NOW())) AS transactions_this_month
    FROM payments
  `);
  return stats;
}

export async function listPayoutRequests(params: {
  page: number; limit: number; status?: string;
}) {
  const { page, limit, status } = params;
  const offset = (page - 1) * limit;

  const where = status ? 'WHERE pr.status = $1' : '';
  const vals  = status ? [status] : [];

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM payout_requests pr ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const requests = await query(`
    SELECT pr.*,
      u.email, u.first_name, u.last_name,
      ta.platform, ta.account_size, ta.current_balance,
      ta.platform_account_id
    FROM payout_requests pr
    JOIN users u ON u.id = pr.user_id
    JOIN trading_accounts ta ON ta.id = pr.account_id
    ${where}
    ORDER BY pr.created_at DESC
    LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
  `, [...vals, limit, offset]);

  return { requests, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function approvePayoutRequest(
  requestId: string,
  adminId: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const req = await client.query(
      'SELECT * FROM payout_requests WHERE id = $1 AND status = $2',
      [requestId, 'pending'],
    );
    if (!req.rows[0]) throw new Error('Payout request not found or not pending');

    const r = req.rows[0];

    // Create payment record
    const pay = await client.query(`
      INSERT INTO payments (user_id, type, status, amount, currency, method,
        description, account_id, processed_by, processed_at)
      VALUES ($1, 'payout', 'completed', $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      r.user_id, r.trader_amount, r.currency,
      r.withdrawal_method, `Payout approval - Period ${r.period_start} to ${r.period_end}`,
      r.account_id, adminId,
    ]);

    await client.query(`
      UPDATE payout_requests
      SET status = 'approved', payment_id = $1, reviewed_by = $2,
          reviewed_at = NOW(), paid_at = NOW(), updated_at = NOW()
      WHERE id = $3
    `, [pay.rows[0].id, adminId, requestId]);

    await client.query(`
      INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id)
      VALUES ($1, 'payout.approved', 'payout_request', $2)
    `, [adminId, requestId]);
  });
}

export async function rejectPayoutRequest(
  requestId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`
      UPDATE payout_requests
      SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
          rejection_reason = $2, updated_at = NOW()
      WHERE id = $3 AND status = 'pending'
    `, [adminId, reason, requestId]);

    await client.query(`
      INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, new_data)
      VALUES ($1, 'payout.rejected', 'payout_request', $2, $3)
    `, [adminId, requestId, JSON.stringify({ reason })]);
  });
}
