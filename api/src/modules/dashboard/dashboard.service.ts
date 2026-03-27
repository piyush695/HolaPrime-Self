import { query } from '../../db/index.js';

export async function getDashboardMetrics() {
  const [users, accounts, payments, risk] = await Promise.all([
    query<Record<string, string>>(`
      SELECT
        COUNT(*)                                                              AS total_users,
        COUNT(*) FILTER (WHERE status = 'active')                            AS active_users,
        COUNT(*) FILTER (WHERE kyc_status = 'approved')                      AS kyc_approved,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))     AS new_this_month,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)                   AS new_today
      FROM users
    `),

    query<Record<string, string>>(`
      SELECT
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (WHERE status = 'active')                            AS active,
        COUNT(*) FILTER (WHERE status = 'breached')                          AS breached,
        COUNT(*) FILTER (WHERE status = 'funded')                            AS funded,
        COUNT(*) FILTER (WHERE status = 'passed')                            AS passed,
        COALESCE(SUM(account_size),0)                                        AS total_notional,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))     AS new_this_month
      FROM trading_accounts
    `),

    query<Record<string, string>>(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type='challenge_fee' AND status='completed'), 0) AS total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE type='payout'        AND status='completed'), 0) AS total_payouts,
        COALESCE(SUM(amount) FILTER (WHERE type='challenge_fee' AND status='completed'
          AND created_at >= DATE_TRUNC('month', NOW())), 0)                   AS revenue_this_month,
        COUNT(*) FILTER (WHERE status = 'pending' AND type = 'challenge_fee') AS pending_payments
      FROM payments
    `),

    query<Record<string, string>>(`
      SELECT
        COUNT(*) FILTER (WHERE acknowledged_at IS NULL)                       AS open_events,
        COUNT(*) FILTER (WHERE severity='critical' AND acknowledged_at IS NULL) AS critical_events
      FROM risk_events
    `),
  ]);

  // Revenue trend — last 12 months
  const revenueTrend = await query<{ month: string; revenue: string; payouts: string; count: string }>(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
      COALESCE(SUM(amount) FILTER (WHERE type='challenge_fee'), 0) AS revenue,
      COALESCE(SUM(amount) FILTER (WHERE type='payout'), 0)        AS payouts,
      COUNT(*) FILTER (WHERE type='challenge_fee')                  AS count
    FROM payments
    WHERE status = 'completed'
      AND created_at >= NOW() - INTERVAL '12 months'
    GROUP BY 1 ORDER BY 1
  `);

  // Account creation trend — last 30 days
  const accountTrend = await query<{ day: string; count: string; breached: string }>(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE status = 'breached') AS breached
    FROM trading_accounts
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1
  `);

  // Platform distribution
  const platformDist = await query<{ platform: string; count: string }>(`
    SELECT platform, COUNT(*) AS count
    FROM trading_accounts
    GROUP BY platform ORDER BY count DESC
  `);

  // Recent risk events
  const recentRisk = await query(`
    SELECT re.*, u.email, ta.platform_account_id, ta.account_size
    FROM risk_events re
    JOIN users u ON u.id = re.user_id
    JOIN trading_accounts ta ON ta.id = re.account_id
    WHERE re.acknowledged_at IS NULL
    ORDER BY CASE re.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
             re.created_at DESC
    LIMIT 10
  `);

  // Recent payments
  const recentPayments = await query(`
    SELECT p.*, u.email, u.first_name, u.last_name
    FROM payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 10
  `);

  return {
    users:          users[0],
    accounts:       accounts[0],
    payments:       payments[0],
    risk:           risk[0],
    revenueTrend,
    accountTrend,
    platformDist,
    recentRisk,
    recentPayments,
  };
}
