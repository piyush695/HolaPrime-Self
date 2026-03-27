import { query, queryOne } from '../../db/index.js';

// ── Cohort retention analysis ─────────────────────────────────────────────────
export async function buildCohortTable(): Promise<void> {
  // For each month cohort, calculate how many users are still active at N months
  const cohorts = await query<{ month: string; count: string }>(`
    SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
           COUNT(*) AS count
    FROM users
    WHERE created_at >= NOW() - INTERVAL '24 months'
    GROUP BY 1 ORDER BY 1
  `);

  for (const cohort of cohorts) {
    const size = parseInt(cohort.count, 10);

    const activity = await query<{ period: string; active: string }>(`
      SELECT
        EXTRACT(MONTH FROM AGE(ta.created_at, u.created_at))::INTEGER AS period,
        COUNT(DISTINCT u.id) AS active
      FROM users u
      JOIN trading_accounts ta ON ta.user_id = u.id
      WHERE TO_CHAR(DATE_TRUNC('month', u.created_at), 'YYYY-MM') = $1
      GROUP BY 1
    `, [cohort.month]);

    const byPeriod: Record<number, number> = {};
    for (const a of activity) byPeriod[parseInt(a.period)] = parseInt(a.active);

    await query(`
      INSERT INTO retention_cohorts
        (cohort_month, cohort_size, period_0, period_1, period_2, period_3, period_6, period_12)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (cohort_month, metric) DO UPDATE SET
        cohort_size = $2, period_0=$3, period_1=$4, period_2=$5, period_3=$6,
        period_6=$7, period_12=$8
    `, [
      cohort.month, size,
      byPeriod[0] ?? null, byPeriod[1] ?? null, byPeriod[2] ?? null,
      byPeriod[3] ?? null, byPeriod[6] ?? null, byPeriod[12] ?? null,
    ]);
  }
}

export async function getCohortData() {
  return query(`
    SELECT *
    FROM retention_cohorts
    ORDER BY cohort_month DESC LIMIT 24
  `);
}

// ── Churn risk scoring ────────────────────────────────────────────────────────
export async function getChurnRiskUsers() {
  // Users who had active accounts but have not traded in 14+ days
  return query(`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.country_code,
      u.created_at AS joined,
      ta.id AS account_id, ta.platform, ta.account_size,
      ta.current_balance, ta.starting_balance,
      (ta.current_balance - ta.starting_balance) / ta.starting_balance * 100 AS return_pct,
      MAX(asnap.snapshot_date) AS last_active_date,
      NOW()::DATE - MAX(asnap.snapshot_date) AS days_inactive,
      CASE
        WHEN NOW()::DATE - MAX(asnap.snapshot_date) >= 30 THEN 'high'
        WHEN NOW()::DATE - MAX(asnap.snapshot_date) >= 14 THEN 'medium'
        ELSE 'low'
      END AS churn_risk
    FROM users u
    JOIN trading_accounts ta ON ta.user_id = u.id AND ta.status = 'active'
    JOIN account_snapshots asnap ON asnap.account_id = ta.id
    WHERE ta.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY u.id, u.email, u.first_name, u.last_name, u.country_code,
             u.created_at, ta.id, ta.platform, ta.account_size,
             ta.current_balance, ta.starting_balance
    HAVING NOW()::DATE - MAX(asnap.snapshot_date) >= 7
    ORDER BY days_inactive DESC
    LIMIT 200
  `);
}

// ── Win-back candidates ───────────────────────────────────────────────────────
export async function getWinBackCandidates() {
  return query(`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.country_code,
      COUNT(ta.id) AS total_accounts,
      MAX(ta.created_at) AS last_account_date,
      NOW()::DATE - MAX(ta.created_at)::DATE AS days_since_last_account,
      SUM(CASE WHEN ta.status = 'passed' THEN 1 ELSE 0 END) AS passed_accounts,
      SUM(CASE WHEN ta.status = 'breached' THEN 1 ELSE 0 END) AS breached_accounts
    FROM users u
    JOIN trading_accounts ta ON ta.user_id = u.id
    WHERE u.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM trading_accounts ta2
        WHERE ta2.user_id = u.id
          AND ta2.status = 'active'
          AND ta2.created_at >= NOW() - INTERVAL '30 days'
      )
    GROUP BY u.id, u.email, u.first_name, u.last_name, u.country_code
    HAVING MAX(ta.created_at) >= NOW() - INTERVAL '180 days'
    ORDER BY days_since_last_account ASC
    LIMIT 200
  `);
}

// ── Lifecycle summary ─────────────────────────────────────────────────────────
export async function getRetentionStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(DISTINCT u.id)                                                   AS total_active_traders,
      COUNT(DISTINCT u.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM trading_accounts ta WHERE ta.user_id = u.id
            AND ta.last_sync_at >= NOW() - INTERVAL '7 days'
        )
      )                                                                      AS active_last_7d,
      COUNT(DISTINCT u.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM trading_accounts ta WHERE ta.user_id = u.id
            AND ta.last_sync_at >= NOW() - INTERVAL '30 days'
        )
      )                                                                      AS active_last_30d,
      COUNT(DISTINCT u.id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM trading_accounts ta WHERE ta.user_id = u.id
            AND ta.status = 'active'
        ) AND u.status = 'active'
      )                                                                      AS no_active_account
    FROM users u
    WHERE u.status = 'active'
  `);

  const conversionRates = await query<Record<string, string>>(`
    SELECT
      COUNT(*) AS registrations,
      COUNT(*) FILTER (WHERE kyc_status = 'approved') AS kyc_approved,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM trading_accounts ta WHERE ta.user_id = users.id)
      ) AS purchased_challenge,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM trading_accounts ta WHERE ta.user_id = users.id AND ta.status IN ('passed','funded'))
      ) AS passed_challenge,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM trading_accounts ta WHERE ta.user_id = users.id AND ta.status = 'funded')
      ) AS funded
    FROM users
    WHERE created_at >= NOW() - INTERVAL '90 days'
  `);

  return { stats, conversionRates };
}
