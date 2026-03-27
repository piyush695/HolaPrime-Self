import { query, queryOne, withTransaction } from '../../db/index.js';
import { writeAudit } from '../audit/audit.service.js';

export async function listPayoutsEnhanced(params: {
  page: number; limit: number;
  status?: string; priority?: string;
  search?: string; from?: string; to?: string;
  batchId?: string;
}) {
  const { page, limit, status, priority, search, from, to, batchId } = params;
  const offset = (page - 1) * limit;
  const conds: string[] = ['1=1'];
  const vals: unknown[] = [];
  let i = 1;

  if (status)   { conds.push(`pr.status = $${i++}`);            vals.push(status); }
  if (priority) { conds.push(`pr.priority = $${i++}`);          vals.push(priority); }
  if (batchId)  { conds.push(`pr.batch_id = $${i++}`);          vals.push(batchId); }
  if (from)     { conds.push(`pr.created_at >= $${i++}`);       vals.push(from); }
  if (to)       { conds.push(`pr.created_at <= $${i++}`);       vals.push(to); }
  if (search) {
    conds.push(`(u.email ILIKE $${i} OR u.first_name ILIKE $${i} OR u.last_name ILIKE $${i})`);
    vals.push(`%${search}%`); i++;
  }

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM payout_requests pr
     JOIN users u ON u.id = pr.user_id WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const requests = await query(`
    SELECT pr.*,
      u.email, u.first_name, u.last_name,
      ta.platform, ta.account_size, ta.platform_account_id, ta.current_balance,
      rev.first_name AS reviewer_first, rev.last_name AS reviewer_last,
      rev.email AS reviewer_email
    FROM payout_requests pr
    JOIN users u ON u.id = pr.user_id
    JOIN trading_accounts ta ON ta.id = pr.account_id
    LEFT JOIN admin_users rev ON rev.id = pr.reviewed_by
    WHERE ${where}
    ORDER BY
      CASE pr.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
      pr.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `, [...vals, limit, offset]);

  return { requests, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getPayoutDetail(id: string) {
  const payout = await queryOne(`
    SELECT pr.*,
      u.email, u.first_name, u.last_name, u.phone, u.country_code,
      ta.platform, ta.account_size, ta.platform_account_id, ta.current_balance,
      rev.first_name AS reviewer_first, rev.last_name AS reviewer_last
    FROM payout_requests pr
    JOIN users u ON u.id = pr.user_id
    JOIN trading_accounts ta ON ta.id = pr.account_id
    LEFT JOIN admin_users rev ON rev.id = pr.reviewed_by
    WHERE pr.id = $1
  `, [id]);

  if (!payout) return null;

  const timeline = await query(
    `SELECT pt.*, au.first_name, au.last_name
     FROM payout_timeline pt
     LEFT JOIN admin_users au ON au.id = pt.actor_id
     WHERE pt.payout_id = $1
     ORDER BY pt.created_at ASC`,
    [id],
  );

  return { ...payout, timeline };
}

export async function approvePayoutEnhanced(
  requestId: string,
  adminId: string,
  adminEmail: string,
  adminRole: string,
  opts?: { note?: string; processedAmount?: number },
): Promise<void> {
  await withTransaction(async (client) => {
    const res = await client.query(
      `SELECT pr.*, u.email AS user_email
       FROM payout_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.id = $1 AND pr.status = 'pending'`,
      [requestId],
    );
    const r = res.rows[0];
    if (!r) throw new Error('Payout request not found or not pending');

    const processedAmount = opts?.processedAmount ?? parseFloat(r.trader_amount);

    const pay = await client.query(`
      INSERT INTO payments (user_id, type, status, amount, currency, method,
        description, account_id, processed_by, processed_at)
      VALUES ($1, 'payout', 'completed', $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      r.user_id, processedAmount, r.currency,
      r.withdrawal_method,
      `Payout - ${r.period_start} to ${r.period_end}`,
      r.account_id, adminId,
    ]);

    await client.query(`
      UPDATE payout_requests
      SET status = 'approved', payment_id = $1, reviewed_by = $2,
          reviewed_at = NOW(), paid_at = NOW(), processed_amount = $3,
          internal_note = COALESCE($4, internal_note), updated_at = NOW()
      WHERE id = $5
    `, [pay.rows[0].id, adminId, processedAmount, opts?.note ?? null, requestId]);

    // Timeline entry
    await client.query(`
      INSERT INTO payout_timeline (payout_id, status, note, actor_id, actor_email, actor_role)
      VALUES ($1, 'approved', $2, $3, $4, $5)
    `, [requestId, opts?.note ?? 'Approved', adminId, adminEmail, adminRole]);
  });

  await writeAudit({
    adminId, adminEmail, adminRole,
    action: 'payout.approve', module: 'payouts',
    entityType: 'payout_request', entityId: requestId,
    description: `Approved payout request ${requestId}`,
  });
}

export async function rejectPayoutEnhanced(
  requestId: string,
  adminId: string,
  adminEmail: string,
  adminRole: string,
  reason: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const res = await client.query(
      `SELECT * FROM payout_requests WHERE id = $1 AND status = 'pending'`,
      [requestId],
    );
    if (!res.rows[0]) throw new Error('Not found or not pending');

    await client.query(`
      UPDATE payout_requests
      SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
          rejection_reason = $2, updated_at = NOW()
      WHERE id = $3
    `, [adminId, reason, requestId]);

    await client.query(`
      INSERT INTO payout_timeline (payout_id, status, note, actor_id, actor_email, actor_role)
      VALUES ($1, 'rejected', $2, $3, $4, $5)
    `, [requestId, reason, adminId, adminEmail, adminRole]);
  });

  await writeAudit({
    adminId, adminEmail, adminRole,
    action: 'payout.reject', module: 'payouts',
    entityType: 'payout_request', entityId: requestId,
    description: `Rejected payout: ${reason}`,
  });
}

export async function batchApprovePayout(
  ids: string[],
  adminId: string,
  adminEmail: string,
  adminRole: string,
): Promise<{ approved: number; failed: number }> {
  let approved = 0; let failed = 0;
  for (const id of ids) {
    try {
      await approvePayoutEnhanced(id, adminId, adminEmail, adminRole);
      approved++;
    } catch { failed++; }
  }
  return { approved, failed };
}

export async function batchRejectPayout(
  ids: string[],
  reason: string,
  adminId: string,
  adminEmail: string,
  adminRole: string,
): Promise<{ rejected: number; failed: number }> {
  let rejected = 0; let failed = 0;
  for (const id of ids) {
    try {
      await rejectPayoutEnhanced(id, adminId, adminEmail, adminRole, reason);
      rejected++;
    } catch { failed++; }
  }
  return { rejected, failed };
}

export async function setPriority(
  requestId: string, priority: 'low' | 'normal' | 'high',
): Promise<void> {
  await query(
    `UPDATE payout_requests SET priority = $1, updated_at = NOW() WHERE id = $2`,
    [priority, requestId],
  );
}

export async function setInternalNote(
  requestId: string, note: string, adminId: string,
): Promise<void> {
  await query(
    `UPDATE payout_requests SET internal_note = $1, updated_at = NOW() WHERE id = $2`,
    [note, requestId],
  );
  await query(`
    INSERT INTO payout_timeline (payout_id, status, note, actor_id)
    SELECT $1, status, $2, $3 FROM payout_requests WHERE id = $1
  `, [requestId, `Note: ${note}`, adminId]);
}

export async function getPayoutStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')                        AS pending_count,
      COUNT(*) FILTER (WHERE status = 'approved')                       AS approved_count,
      COUNT(*) FILTER (WHERE status = 'rejected')                       AS rejected_count,
      COUNT(*) FILTER (WHERE priority = 'high' AND status = 'pending')  AS high_priority_count,
      COALESCE(SUM(trader_amount) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
      COALESCE(SUM(trader_amount) FILTER (WHERE status = 'approved'), 0) AS approved_amount,
      COALESCE(SUM(trader_amount) FILTER (WHERE status = 'approved'
        AND paid_at >= CURRENT_DATE), 0)                                 AS paid_today
    FROM payout_requests
  `);
  return stats;
}
