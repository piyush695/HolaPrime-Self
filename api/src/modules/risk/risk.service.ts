import { query, queryOne, withTransaction } from '../../db/index.js';
import { getPlatformAdapter } from '../../platform/platform.service.js';
import type { PlatformType } from '../../platform/adapter.interface.js';

// ── Risk monitoring ───────────────────────────────────────────────────────────

export async function getActiveRiskEvents(params: {
  page: number; limit: number; severity?: string; acknowledged?: boolean;
}) {
  const { page, limit, severity, acknowledged } = params;
  const offset = (page - 1) * limit;
  const conds: string[] = ['1=1'];
  const vals: unknown[] = [];
  let   i = 1;

  if (severity) { conds.push(`re.severity = $${i++}`); vals.push(severity); }
  if (acknowledged === false) conds.push('re.acknowledged_at IS NULL');
  if (acknowledged === true)  conds.push('re.acknowledged_at IS NOT NULL');

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM risk_events re WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const events = await query(`
    SELECT re.*,
      u.email, u.first_name, u.last_name,
      ta.platform, ta.platform_account_id, ta.account_size,
      ta.current_balance, ta.starting_balance, ta.phase,
      a.first_name AS ack_first, a.last_name AS ack_last
    FROM risk_events re
    JOIN users u  ON u.id = re.user_id
    JOIN trading_accounts ta ON ta.id = re.account_id
    LEFT JOIN admin_users a  ON a.id = re.acknowledged_by
    WHERE ${where}
    ORDER BY
      CASE re.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      re.created_at DESC
    LIMIT $${i} OFFSET $${i+1}
  `, [...vals, limit, offset]);

  return { events, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function acknowledgeRiskEvent(
  eventId: string,
  adminId: string,
): Promise<void> {
  await query(
    `UPDATE risk_events SET acknowledged_by = $1, acknowledged_at = NOW()
     WHERE id = $2`,
    [adminId, eventId],
  );
}

export async function getRiskStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) FILTER (WHERE acknowledged_at IS NULL)                         AS unacknowledged,
      COUNT(*) FILTER (WHERE severity = 'critical' AND acknowledged_at IS NULL) AS critical_unacked,
      COUNT(*) FILTER (WHERE severity = 'warning' AND acknowledged_at IS NULL)  AS warning_unacked,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')       AS last_24h,
      (SELECT COUNT(*) FROM trading_accounts WHERE status = 'breached')       AS breached_accounts,
      (SELECT COUNT(*) FROM trading_accounts WHERE status = 'active')         AS accounts_at_risk
    FROM risk_events
  `);
  return stats;
}

// ── Core breach checker (called by sync job) ──────────────────────────────────

export async function checkAccountRisk(accountId: string): Promise<void> {
  const account = await queryOne<{
    id: string; user_id: string; platform: string;
    platform_account_id: string; starting_balance: number;
    current_balance: number; max_daily_loss: number; max_total_loss: number;
    status: string;
  }>(`SELECT * FROM trading_accounts WHERE id = $1`, [accountId]);

  if (!account || account.status !== 'active' || !account.platform_account_id) return;

  const adapter = getPlatformAdapter(account.platform as PlatformType);

  let balance;
  try {
    balance = await adapter.getBalance(account.platform_account_id);
  } catch {
    return; // Platform unavailable — skip
  }

  const totalDrawdownPct = ((account.starting_balance - balance.equity) / account.starting_balance) * 100;

  await withTransaction(async (client) => {
    // Daily loss check
    const today = new Date().toISOString().split('T')[0];
    const snap  = await client.query(
      `SELECT balance FROM account_snapshots WHERE account_id = $1 AND snapshot_date = $2`,
      [accountId, today],
    );

    const openBalance   = snap.rows[0]?.balance ?? account.starting_balance;
    const dailyLossPct  = ((openBalance - balance.equity) / account.starting_balance) * 100;
    const dailyLossThreshold = account.max_daily_loss;

    if (dailyLossPct >= dailyLossThreshold * 0.8 && dailyLossPct < dailyLossThreshold) {
      // Warning at 80%
      await emitRiskEvent(client, {
        accountId, userId: account.user_id,
        type: 'daily_loss_warning', severity: 'warning',
        message: `Daily loss at ${dailyLossPct.toFixed(2)}% — limit is ${dailyLossThreshold}%`,
        data: { dailyLossPct, dailyLossThreshold, balance: balance.equity },
      });
    }

    if (dailyLossPct >= dailyLossThreshold) {
      // Breach
      await emitRiskEvent(client, {
        accountId, userId: account.user_id,
        type: 'daily_loss_breach', severity: 'critical',
        message: `Daily loss limit breached: ${dailyLossPct.toFixed(2)}%`,
        data: { dailyLossPct, dailyLossThreshold, balance: balance.equity },
      });
    }

    // Total drawdown check
    if (totalDrawdownPct >= account.max_total_loss * 0.8 && totalDrawdownPct < account.max_total_loss) {
      await emitRiskEvent(client, {
        accountId, userId: account.user_id,
        type: 'drawdown_warning', severity: 'warning',
        message: `Total drawdown at ${totalDrawdownPct.toFixed(2)}% — limit is ${account.max_total_loss}%`,
        data: { totalDrawdownPct, maxTotalLoss: account.max_total_loss, balance: balance.equity },
      });
    }

    if (totalDrawdownPct >= account.max_total_loss) {
      await emitRiskEvent(client, {
        accountId, userId: account.user_id,
        type: 'drawdown_breach', severity: 'critical',
        message: `Maximum drawdown breached: ${totalDrawdownPct.toFixed(2)}%`,
        data: { totalDrawdownPct, maxTotalLoss: account.max_total_loss, balance: balance.equity },
      });

      // Auto-breach the account
      await client.query(`
        UPDATE trading_accounts
        SET status = 'breached', breach_type = 'max_drawdown', breached_at = NOW(),
            current_balance = $1, current_equity = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'active'
      `, [balance.balance, balance.equity, accountId]);

      // Disable trading on platform
      try {
        await adapter.setTradingEnabled(account.platform_account_id, false);
      } catch { /* best effort */ }
    }
  });
}

async function emitRiskEvent(
  client: { query: (sql: string, vals: unknown[]) => Promise<unknown> },
  params: {
    accountId: string; userId: string;
    type: string; severity: string;
    message: string; data: Record<string, unknown>;
  },
): Promise<void> {
  // Deduplicate — don't re-emit same event type within 1 hour
  const existing = await client.query(`
    SELECT id FROM risk_events
    WHERE account_id = $1 AND event_type = $2
      AND created_at >= NOW() - INTERVAL '1 hour'
    LIMIT 1
  `, [params.accountId, params.type]);

  if ((existing as any).rows?.length > 0) return;

  await client.query(`
    INSERT INTO risk_events (account_id, user_id, event_type, severity, message, data)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    params.accountId, params.userId,
    params.type, params.severity,
    params.message, JSON.stringify(params.data),
  ]);
}

// Scan ALL active accounts — called by BullMQ job every 5 minutes
export async function scanAllActiveAccounts(): Promise<void> {
  const accounts = await query<{ id: string }>(
    `SELECT id FROM trading_accounts WHERE status = 'active' AND platform_account_id IS NOT NULL`,
  );

  // Process in batches of 10 to avoid overwhelming the platform APIs
  const BATCH = 10;
  for (let i = 0; i < accounts.length; i += BATCH) {
    await Promise.allSettled(
      accounts.slice(i, i + BATCH).map((a) => checkAccountRisk(a.id)),
    );
  }
}
