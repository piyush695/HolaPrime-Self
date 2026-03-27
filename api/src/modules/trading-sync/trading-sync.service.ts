import { query, queryOne, withTransaction } from '../../db/index.js';
import { getPlatformAdapter } from '../../platform/platform.service.js';
import type { PlatformType } from '../../platform/adapter.interface.js';

// ── Full account sync: balance + positions + daily PL ────────────────────────
export async function syncAccountFull(accountId: string): Promise<void> {
  const account = await queryOne<{
    id: string; platform: string; platform_account_id: string;
    starting_balance: number; current_balance: number;
    max_daily_loss: number; max_total_loss: number;
    status: string;
  }>(`SELECT * FROM trading_accounts WHERE id = $1`, [accountId]);

  if (!account || !account.platform_account_id) return;
  if (!['active', 'funded'].includes(account.status)) return;

  const adapter = getPlatformAdapter(account.platform as PlatformType);

  try {
    // 1) Balance
    const balance = await adapter.getBalance(account.platform_account_id);

    // 2) Open positions
    const positions = await adapter.getOpenTrades(account.platform_account_id);

    const totalPlPct = ((balance.balance - account.starting_balance) / account.starting_balance) * 100;
    const today = new Date().toISOString().split('T')[0];

    // Get yesterday's snapshot for daily PL calc
    const [yday] = await query<{ balance: number }>(
      `SELECT balance FROM account_snapshots
       WHERE account_id = $1 AND snapshot_date = CURRENT_DATE - 1`,
      [accountId],
    );
    const prevBalance = yday?.balance ?? account.starting_balance;
    const dailyPL = balance.balance - prevBalance;
    const dailyPLPct = prevBalance > 0 ? (dailyPL / prevBalance) * 100 : 0;

    await withTransaction(async (client) => {
      // Update account
      await client.query(`
        UPDATE trading_accounts SET
          current_balance  = $1,
          current_equity   = $2,
          floating_pl      = $3,
          open_positions   = $4,
          daily_pl         = $5,
          daily_pl_pct     = $6,
          last_sync_at     = NOW(),
          sync_error       = NULL,
          sync_fail_count  = 0,
          updated_at       = NOW()
        WHERE id = $7
      `, [
        balance.balance, balance.equity, balance.floatingPL,
        positions.length, dailyPL, dailyPLPct, accountId,
      ]);

      // Upsert daily snapshot
      await client.query(`
        INSERT INTO account_snapshots
          (account_id, snapshot_date, balance, equity, floating_pl, total_pl, total_pl_pct)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (account_id, snapshot_date) DO UPDATE SET
          balance = $3, equity = $4, floating_pl = $5, total_pl = $6, total_pl_pct = $7
      `, [
        accountId, today,
        balance.balance, balance.equity, balance.floatingPL,
        balance.balance - account.starting_balance, totalPlPct,
      ]);

      // Replace open positions
      await client.query(`DELETE FROM account_positions WHERE account_id = $1`, [accountId]);
      for (const p of positions) {
        await client.query(`
          INSERT INTO account_positions
            (account_id, ticket, symbol, direction, lots, open_price,
             current_price, sl, tp, commission, swap, floating_pl, open_time)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (account_id, ticket) DO UPDATE SET
            current_price = $7, floating_pl = $12, swap = $11, synced_at = NOW()
        `, [
          accountId, p.ticket, p.symbol, p.direction, p.lots,
          p.openPrice, p.openPrice, // current_price placeholder — bridge provides it
          p.sl, p.tp, p.commission, p.swap, p.profit, p.openTime,
        ]);
      }
    });

  } catch (err) {
    // Record failure without crashing the job runner
    await query(`
      UPDATE trading_accounts
      SET sync_error = $1, sync_fail_count = sync_fail_count + 1, updated_at = NOW()
      WHERE id = $2
    `, [String(err), accountId]);
  }
}

// ── Sync stats for admin dashboard ───────────────────────────────────────────
export async function getTradingStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('active','funded') AND platform_account_id IS NOT NULL) AS total_live,
      COUNT(*) FILTER (WHERE status IN ('active','funded')
        AND last_sync_at > NOW() - INTERVAL '20 minutes') AS synced_recently,
      COUNT(*) FILTER (WHERE sync_fail_count > 0)  AS sync_errors,
      COUNT(*) FILTER (WHERE open_positions > 0)   AS accounts_in_trade,
      COALESCE(SUM(open_positions), 0)             AS total_open_positions,
      COALESCE(SUM(floating_pl)   FILTER (WHERE status IN ('active','funded')), 0) AS total_floating_pl,
      COALESCE(SUM(current_balance) FILTER (WHERE status = 'funded'), 0)           AS total_funded_capital
    FROM trading_accounts
  `);
  return stats;
}

export async function listSyncAccounts(params: {
  page: number; limit: number;
  platform?: string; status?: string;
  hasError?: boolean; search?: string;
}) {
  const { page, limit, platform, status, hasError, search } = params;
  const offset = (page - 1) * limit;
  const conds = ['ta.platform_account_id IS NOT NULL'];
  const vals: unknown[] = [];
  let i = 1;

  if (platform) { conds.push(`ta.platform = $${i++}`);       vals.push(platform); }
  if (status)   { conds.push(`ta.status = $${i++}`);          vals.push(status); }
  if (hasError) { conds.push(`ta.sync_fail_count > 0`); }
  if (search) {
    conds.push(`(u.email ILIKE $${i} OR ta.platform_account_id ILIKE $${i})`);
    vals.push(`%${search}%`); i++;
  }

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM trading_accounts ta
     JOIN users u ON u.id = ta.user_id WHERE ${where}`, vals,
  );

  const accounts = await query(`
    SELECT ta.id, ta.platform, ta.platform_account_id, ta.status,
      ta.account_size, ta.current_balance, ta.current_equity,
      ta.floating_pl, ta.open_positions, ta.daily_pl, ta.daily_pl_pct,
      ta.last_sync_at, ta.sync_error, ta.sync_fail_count,
      u.email, u.first_name, u.last_name
    FROM trading_accounts ta
    JOIN users u ON u.id = ta.user_id
    WHERE ${where}
    ORDER BY ta.last_sync_at DESC NULLS LAST
    LIMIT $${i} OFFSET $${i + 1}
  `, [...vals, limit, offset]);

  return {
    accounts,
    total: parseInt(countRow?.count ?? '0', 10),
    page, limit,
    pages: Math.ceil(parseInt(countRow?.count ?? '0', 10) / limit),
  };
}

export async function getAccountPositions(accountId: string) {
  return query(
    `SELECT * FROM account_positions WHERE account_id = $1 ORDER BY floating_pl ASC`,
    [accountId],
  );
}

export async function triggerManualSync(accountId: string): Promise<void> {
  await syncAccountFull(accountId);
}
