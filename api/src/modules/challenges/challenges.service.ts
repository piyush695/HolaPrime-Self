import { query, queryOne, withTransaction } from '../../db/index.js';
import { fireEvent } from '../integrations/event-bus.js';
import { getPlatformAdapter } from '../../platform/platform.service.js';
import type { PlatformType } from '../../platform/adapter.interface.js';

// ── Challenge Products ────────────────────────────────────────────────────────

export async function listProducts() {
  return query(`
    SELECT cp.*,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.product_id = cp.id) AS total_accounts,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.product_id = cp.id AND ta.status = 'active') AS active_accounts
    FROM challenge_products cp
    ORDER BY sort_order, created_at
  `);
}

export async function getProduct(id: string) {
  return queryOne(
    'SELECT * FROM challenge_products WHERE id = $1', [id],
  );
}

export async function createProduct(data: Record<string, unknown>, adminId: string) {
  const [product] = await query(`
    INSERT INTO challenge_products
      (name, slug, description, status, account_size, fee, currency, platform,
       phases, leverage, instruments_allowed, news_trading_allowed,
       weekend_holding_allowed, scaling_plan, profit_split, payout_frequency,
       sort_order, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING *
  `, [
    data.name, data.slug, data.description, data.status ?? 'draft',
    data.accountSize, data.fee, data.currency ?? 'USD', data.platform ?? 'mt5',
    JSON.stringify(data.phases ?? []), data.leverage ?? '1:100',
    data.instrumentsAllowed ?? ['FOREX','GOLD','INDICES'],
    data.newsTradingAllowed ?? false,
    data.weekendHoldingAllowed ?? false,
    data.scalingPlan ?? false,
    data.profitSplit ?? 80,
    data.payoutFrequency ?? 'monthly',
    data.sortOrder ?? 0,
    adminId,
  ]);
  return product;
}

// ── Trading Accounts ──────────────────────────────────────────────────────────

export async function listAccounts(params: {
  page: number; limit: number; userId?: string;
  status?: string; platform?: string; phase?: string;
}) {
  const { page, limit, userId, status, platform, phase } = params;
  const offset = (page - 1) * limit;

  const conds: string[]  = ['1=1'];
  const vals: unknown[]  = [];
  let   i = 1;

  if (userId)   { conds.push(`ta.user_id = $${i++}`);   vals.push(userId); }
  if (status)   { conds.push(`ta.status = $${i++}`);    vals.push(status); }
  if (platform) { conds.push(`ta.platform = $${i++}`);  vals.push(platform); }
  if (phase)    { conds.push(`ta.phase = $${i++}`);     vals.push(phase); }

  const where = conds.join(' AND ');

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM trading_accounts ta WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const accounts = await query(`
    SELECT ta.*,
      u.email, u.first_name, u.last_name,
      cp.name AS product_name, cp.fee AS product_fee
    FROM trading_accounts ta
    JOIN users u ON u.id = ta.user_id
    JOIN challenge_products cp ON cp.id = ta.product_id
    WHERE ${where}
    ORDER BY ta.created_at DESC
    LIMIT $${i} OFFSET $${i+1}
  `, [...vals, limit, offset]);

  return { accounts, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAccountDetail(accountId: string) {
  const account = await queryOne(`
    SELECT ta.*,
      u.email, u.first_name, u.last_name, u.country_code,
      cp.name AS product_name, cp.phases AS product_phases
    FROM trading_accounts ta
    JOIN users u  ON u.id = ta.user_id
    JOIN challenge_products cp ON cp.id = ta.product_id
    WHERE ta.id = $1
  `, [accountId]);

  if (!account) return null;

  const snapshots = await query(
    `SELECT * FROM account_snapshots WHERE account_id = $1
     ORDER BY snapshot_date DESC LIMIT 30`,
    [accountId],
  );

  const recentTrades = await query(
    `SELECT * FROM account_trades WHERE account_id = $1
     ORDER BY open_time DESC LIMIT 50`,
    [accountId],
  );

  const riskEvents = await query(
    `SELECT * FROM risk_events WHERE account_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [accountId],
  );

  return { ...account, snapshots, recentTrades, riskEvents };
}

export async function provisionAccount(params: {
  userId: string;
  productId: string;
  paymentId: string;
  adminId?: string;
}): Promise<string> {
  const product = await queryOne<{
    id: string; account_size: number; currency: string;
    platform: string; phases: string;
  }>('SELECT * FROM challenge_products WHERE id = $1', [params.productId]);

  if (!product) throw new Error('Product not found');

  const user = await queryOne<{
    id: string; email: string; first_name: string; last_name: string;
  }>('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [params.userId]);

  if (!user) throw new Error('User not found');

  const phases = typeof product.phases === 'string'
    ? JSON.parse(product.phases)
    : product.phases as Array<{
        phase: string; profit_target: number; max_daily_loss: number;
        max_total_loss: number; min_trading_days: number; max_duration_days: number;
      }>;

  const firstPhase = phases[0];
  if (!firstPhase) throw new Error('Product has no phases configured');

  const adapter = getPlatformAdapter(product.platform as PlatformType);
  const platformAccount = await adapter.createAccount({
    name:     `${user.first_name} ${user.last_name}`,
    email:    user.email,
    balance:  product.account_size,
    currency: product.currency,
    leverage: 100,
    group:    `prop_${firstPhase.phase}`,
  });

  const accountId = await withTransaction(async (client) => {
    const result = await client.query(`
      INSERT INTO trading_accounts (
        user_id, product_id, platform,
        platform_account_id, platform_password, platform_server,
        phase, status, account_size, currency,
        starting_balance, current_balance, current_equity,
        profit_target, max_daily_loss, max_total_loss,
        min_trading_days, max_duration_days,
        phase_started_at, phase_ends_at, payment_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),$19,$20)
      RETURNING id
    `, [
      params.userId, params.productId, product.platform,
      platformAccount.platformLogin,
      platformAccount.mainPassword,
      platformAccount.platformServer,
      'evaluation', 'active',
      product.account_size, product.currency,
      product.account_size, product.account_size, product.account_size,
      firstPhase.profit_target, firstPhase.max_daily_loss, firstPhase.max_total_loss,
      firstPhase.min_trading_days,
      firstPhase.max_duration_days
        ? new Date(Date.now() + firstPhase.max_duration_days * 86400000).toISOString()
        : null,
      firstPhase.max_duration_days
        ? new Date(Date.now() + firstPhase.max_duration_days * 86400000).toISOString()
        : null,
      params.paymentId,
    ]);

    return result.rows[0].id as string;
  });

  return accountId;
}

export async function syncAccountBalance(accountId: string): Promise<void> {
  const account = await queryOne<{
    id: string; platform: string; platform_account_id: string;
    starting_balance: number; max_daily_loss: number; max_total_loss: number;
  }>('SELECT * FROM trading_accounts WHERE id = $1', [accountId]);

  if (!account || !account.platform_account_id) return;

  const adapter = getPlatformAdapter(account.platform as PlatformType);
  const balance = await adapter.getBalance(account.platform_account_id);

  const totalPlPct = ((balance.balance - account.starting_balance) / account.starting_balance) * 100;

  await withTransaction(async (client) => {
    await client.query(`
      UPDATE trading_accounts
      SET current_balance = $1, current_equity = $2, last_sync_at = NOW(), updated_at = NOW()
      WHERE id = $3
    `, [balance.balance, balance.equity, accountId]);

    const today = new Date().toISOString().split('T')[0];
    await client.query(`
      INSERT INTO account_snapshots (account_id, snapshot_date, balance, equity, floating_pl, total_pl, total_pl_pct)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (account_id, snapshot_date) DO UPDATE
      SET balance = $3, equity = $4, floating_pl = $5, total_pl = $6, total_pl_pct = $7
    `, [
      accountId, today,
      balance.balance, balance.equity, balance.floatingPL,
      balance.balance - account.starting_balance, totalPlPct,
    ]);

    // Check breaches
    const drawdownPct = ((account.starting_balance - balance.equity) / account.starting_balance) * 100;
    if (drawdownPct >= account.max_total_loss) {
      await client.query(`
        UPDATE trading_accounts
        SET status = 'breached', breach_type = 'max_drawdown', breached_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status = 'active'
      `, [accountId]);
    }
  });
}

export async function getAccountStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*)                                                              AS total,
      COUNT(*) FILTER (WHERE status = 'active')                            AS active,
      COUNT(*) FILTER (WHERE status = 'breached')                          AS breached,
      COUNT(*) FILTER (WHERE status = 'passed')                            AS passed,
      COUNT(*) FILTER (WHERE status = 'funded')                            AS funded,
      COUNT(*) FILTER (WHERE status = 'failed')                            AS failed,
      COUNT(*) FILTER (WHERE phase = 'evaluation')                         AS in_evaluation,
      COUNT(*) FILTER (WHERE phase = 'verification')                       AS in_verification,
      COUNT(*) FILTER (WHERE phase = 'funded')                             AS in_funded,
      COALESCE(SUM(account_size),0)                                        AS total_notional,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))     AS new_this_month
    FROM trading_accounts
  `);
  return stats;
}
