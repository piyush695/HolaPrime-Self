import { query, queryOne, withTransaction } from '../../db/index.js';

// ── Report query builders ─────────────────────────────────────────────────────
type ReportConfig = {
  from?: string; to?: string;
  groupBy?: string; filters?: Record<string, unknown>;
};

async function buildRevenueReport(cfg: ReportConfig) {
  const from = cfg.from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to   = cfg.to   ?? new Date().toISOString().split('T')[0];

  const rows = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', p.created_at), 'YYYY-MM-DD') AS date,
      p.type,
      p.method,
      COUNT(*)                                                 AS transactions,
      SUM(p.amount)                                            AS total_amount,
      SUM(CASE WHEN p.type='challenge_fee' THEN p.amount ELSE 0 END) AS fees,
      SUM(CASE WHEN p.type='payout'        THEN p.amount ELSE 0 END) AS payouts
    FROM payments p
    WHERE p.status = 'completed'
      AND p.created_at::date BETWEEN $1 AND $2
    GROUP BY 1, 2, 3 ORDER BY 1, 2
  `, [from, to]);

  const summary = await queryOne<Record<string, string>>(`
    SELECT
      COUNT(*)                                AS total_transactions,
      COALESCE(SUM(amount),0)                 AS total_volume,
      COALESCE(SUM(CASE WHEN type='challenge_fee' THEN amount ELSE 0 END),0) AS total_fees,
      COALESCE(SUM(CASE WHEN type='payout'        THEN amount ELSE 0 END),0) AS total_payouts,
      COALESCE(SUM(CASE WHEN type='refund'        THEN amount ELSE 0 END),0) AS total_refunds
    FROM payments
    WHERE status = 'completed' AND created_at::date BETWEEN $1 AND $2
  `, [from, to]);

  return { rows, summary, from, to };
}

async function buildUserReport(cfg: ReportConfig) {
  const from = cfg.from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to   = cfg.to   ?? new Date().toISOString().split('T')[0];

  const rows = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', u.created_at), 'YYYY-MM-DD') AS date,
      COUNT(*)                                                 AS registrations,
      COUNT(*) FILTER (WHERE u.kyc_status = 'approved')       AS kyc_approved,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM trading_accounts ta WHERE ta.user_id = u.id
      ))                                                       AS purchased,
      u.country_code
    FROM users u
    WHERE u.created_at::date BETWEEN $1 AND $2
    GROUP BY 1, u.country_code ORDER BY 1
  `, [from, to]);

  const topCountries = await query(`
    SELECT country_code, COUNT(*) AS users
    FROM users
    WHERE created_at::date BETWEEN $1 AND $2
    GROUP BY country_code ORDER BY users DESC LIMIT 20
  `, [from, to]);

  return { rows, topCountries, from, to };
}

async function buildRiskReport(cfg: ReportConfig) {
  const from = cfg.from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to   = cfg.to   ?? new Date().toISOString().split('T')[0];

  const breach_summary = await query(`
    SELECT
      breach_type,
      COUNT(*) AS count,
      SUM(account_size) AS total_notional,
      AVG((current_balance - starting_balance) / starting_balance * 100) AS avg_return_at_breach
    FROM trading_accounts
    WHERE status = 'breached'
      AND breached_at::date BETWEEN $1 AND $2
    GROUP BY breach_type ORDER BY count DESC
  `, [from, to]);

  const daily = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', re.created_at), 'YYYY-MM-DD') AS date,
      re.event_type,
      COUNT(*) AS count
    FROM risk_events re
    WHERE re.created_at::date BETWEEN $1 AND $2
    GROUP BY 1, 2 ORDER BY 1
  `, [from, to]);

  return { breach_summary, daily, from, to };
}

async function buildAffiliateReport(cfg: ReportConfig) {
  const from = cfg.from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to   = cfg.to   ?? new Date().toISOString().split('T')[0];

  const rows = await query(`
    SELECT
      a.first_name, a.last_name, a.email, a.code,
      COUNT(ac.id)                    AS conversions,
      COALESCE(SUM(ac.commission),0)  AS commissions_earned,
      COUNT(DISTINCT ac.user_id)      AS unique_referrals
    FROM affiliates a
    LEFT JOIN affiliate_conversions ac ON ac.affiliate_id = a.id
      AND ac.created_at::date BETWEEN $1 AND $2
    WHERE a.status = 'active'
    GROUP BY a.id, a.first_name, a.last_name, a.email, a.code
    ORDER BY commissions_earned DESC
  `, [from, to]);

  return { rows, from, to };
}

// ── Format as CSV ─────────────────────────────────────────────────────────────
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines   = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? '');
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ),
  ];
  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateReport(params: {
  type: string; from?: string; to?: string;
  format: string; triggeredBy?: string;
  definitionId?: string;
}): Promise<{ data: Record<string, unknown>; csv?: string }> {
  const cfg: ReportConfig = { from: params.from, to: params.to };

  let data: Record<string, unknown>;
  switch (params.type) {
    case 'revenue':   data = await buildRevenueReport(cfg);   break;
    case 'users':     data = await buildUserReport(cfg);       break;
    case 'risk':      data = await buildRiskReport(cfg);       break;
    case 'affiliates':data = await buildAffiliateReport(cfg);  break;
    default: throw new Error(`Unknown report type: ${params.type}`);
  }

  const csv = params.format === 'csv'
    ? toCSV(Array.isArray((data as any).rows) ? (data as any).rows : [])
    : undefined;

  return { data, csv };
}

export async function listReportDefinitions() {
  return query('SELECT * FROM report_definitions ORDER BY name');
}

export async function createReportDefinition(data: {
  name: string; type: string; format: string;
  frequency?: string; recipients?: string[];
  queryConfig?: Record<string, unknown>;
}, adminId: string): Promise<string> {
  const [r] = await query<{ id: string }>(`
    INSERT INTO report_definitions
      (name, type, format, frequency, recipients, query_config, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [
    data.name, data.type, data.format,
    data.frequency, data.recipients ?? [],
    JSON.stringify(data.queryConfig ?? {}), adminId,
  ]);
  return r.id;
}

export async function listReportRuns(definitionId?: string) {
  const where = definitionId ? 'WHERE rr.definition_id = $1' : '';
  const vals  = definitionId ? [definitionId] : [];
  return query(`
    SELECT rr.*, rd.name AS report_name,
           a.first_name, a.last_name
    FROM report_runs rr
    LEFT JOIN report_definitions rd ON rd.id = rr.definition_id
    LEFT JOIN admin_users a ON a.id = rr.triggered_by
    ${where}
    ORDER BY rr.created_at DESC LIMIT 100
  `, vals);
}
