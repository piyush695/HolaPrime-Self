import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  getRetentionStats, getCohortData, getChurnRiskUsers,
  getWinBackCandidates, buildCohortTable,
} from './retention.service.js';
import { query } from '../../db/index.js';

export async function retentionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  app.get('/stats',      async (_r, reply) => reply.send(await getRetentionStats()));
  app.get('/cohorts',    async (_r, reply) => reply.send(await getCohortData()));
  app.get('/churn-risk', async (_r, reply) => reply.send(await getChurnRiskUsers()));
  app.get('/win-back',   async (_r, reply) => reply.send(await getWinBackCandidates()));

  app.post('/rebuild-cohorts', async (_r, reply) => {
    await buildCohortTable();
    return reply.send({ ok: true });
  });

  // ── New User Cohort: track D0,D1,D2...D30 activity ─────────────────────────
  app.get('/new-user-cohort', async (req, reply) => {
    const { days = '30', from, to } = req.query as Record<string, string>;
    const maxDays = Math.min(parseInt(days), 60);

    // Build day columns dynamically
    const dayCols = Array.from({ length: maxDays + 1 }, (_, d) =>
      `COUNT(DISTINCT CASE WHEN DATE(p.created_at) - DATE(u.created_at) = ${d} THEN u.id END) AS d${d}_purchasers,
       COALESCE(SUM(CASE WHEN DATE(p.created_at) - DATE(u.created_at) = ${d} THEN p.amount ELSE 0 END), 0) AS d${d}_revenue`
    ).join(',\n      ');

    const dateFilter = from && to
      ? `AND u.created_at BETWEEN '${from}' AND '${to}'::date + INTERVAL '1 day'`
      : `AND u.created_at >= NOW() - INTERVAL '${maxDays} days'`;

    const rows = await query(`
      SELECT
        DATE(u.created_at) AS cohort_date,
        COUNT(DISTINCT u.id) AS new_users,
        ${dayCols}
      FROM users u
      LEFT JOIN payments p ON p.user_id = u.id
        AND p.type = 'challenge_fee' AND p.status = 'completed'
        AND DATE(p.created_at) - DATE(u.created_at) BETWEEN 0 AND ${maxDays}
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(u.created_at)
      ORDER BY cohort_date DESC
      LIMIT 60
    `);
    return reply.send({ rows, days: maxDays });
  });

  // ── Repeat User Activity: DoD/WoW/MoM ──────────────────────────────────────
  app.get('/repeat-activity', async (req, reply) => {
    const { period = 'daily', periods = '30' } = req.query as Record<string, string>;
    const n = Math.min(parseInt(periods), 90);

    const trunc = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'day';
    const interval = period === 'weekly' ? `${n} weeks` : period === 'monthly' ? `${n} months` : `${n} days`;

    const rows = await query(`
      WITH period_data AS (
        SELECT
          DATE_TRUNC('${trunc}', p.created_at) AS period,
          COUNT(DISTINCT p.user_id)                          AS users,
          COUNT(p.id)                                        AS orders,
          COALESCE(SUM(p.amount), 0)                         AS revenue,
          COALESCE(AVG(p.amount), 0)                         AS aov,
          COALESCE(SUM(p.amount) / NULLIF(COUNT(DISTINCT p.user_id), 0), 0) AS arpu
        FROM payments p
        WHERE p.type = 'challenge_fee'
          AND p.status = 'completed'
          AND p.created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY 1
      ),
      repeat_data AS (
        SELECT
          DATE_TRUNC('${trunc}', p.created_at) AS period,
          COUNT(DISTINCT p.user_id) AS repeat_users
        FROM payments p
        WHERE p.type = 'challenge_fee'
          AND p.status = 'completed'
          AND p.created_at >= NOW() - INTERVAL '${interval}'
          AND (SELECT COUNT(*) FROM payments p2
               WHERE p2.user_id = p.user_id
                 AND p2.type = 'challenge_fee'
                 AND p2.status = 'completed'
                 AND p2.created_at < p.created_at) > 0
        GROUP BY 1
      )
      SELECT
        pd.period,
        pd.users,
        pd.orders,
        ROUND(pd.revenue::numeric, 2)   AS revenue,
        ROUND(pd.aov::numeric, 2)       AS aov,
        ROUND(pd.arpu::numeric, 2)      AS arpu,
        COALESCE(rd.repeat_users, 0)    AS repeat_users,
        ROUND(
          COALESCE(rd.repeat_users, 0)::numeric /
          NULLIF(pd.users, 0) * 100, 1
        ) AS repeat_rate
      FROM period_data pd
      LEFT JOIN repeat_data rd ON rd.period = pd.period
      ORDER BY pd.period DESC
    `);
    return reply.send({ rows, period, periods: n });
  });

  // ── Period-over-Period comparison (DoD / WoW / MoM) ────────────────────────
  app.get('/period-comparison', async (req, reply) => {
    const { period = 'daily' } = req.query as Record<string, string>;
    const trunc = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'day';
    const prev = period === 'weekly' ? '2 weeks' : period === 'monthly' ? '2 months' : '2 days';

    const current = await query(`
      SELECT
        COUNT(DISTINCT user_id)   AS users,
        COUNT(id)                 AS orders,
        COALESCE(SUM(amount), 0)  AS revenue,
        COALESCE(AVG(amount), 0)  AS aov
      FROM payments
      WHERE type='challenge_fee' AND status='completed'
        AND created_at >= DATE_TRUNC('${trunc}', NOW())
    `);
    const previous = await query(`
      SELECT
        COUNT(DISTINCT user_id)   AS users,
        COUNT(id)                 AS orders,
        COALESCE(SUM(amount), 0)  AS revenue,
        COALESCE(AVG(amount), 0)  AS aov
      FROM payments
      WHERE type='challenge_fee' AND status='completed'
        AND created_at >= DATE_TRUNC('${trunc}', NOW() - INTERVAL '${prev}')
        AND created_at <  DATE_TRUNC('${trunc}', NOW())
    `);
    return reply.send({ current: current[0], previous: previous[0], period });
  });

  // ── Full Cohort Revenue Table (by registration cohort) ──────────────────────
  app.get('/revenue-cohort', async (req, reply) => {
    const { granularity = 'monthly' } = req.query as Record<string, string>;
    const trunc = granularity === 'weekly' ? 'week' : 'month';

    const rows = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('${trunc}', u.created_at), 'YYYY-MM') AS cohort,
        COUNT(DISTINCT u.id)                                       AS cohort_size,
        -- Activity periods 0–11
        ${Array.from({ length: 12 }, (_, i) => `
          COALESCE(SUM(p.amount) FILTER (
            WHERE DATE_TRUNC('${trunc}', p.created_at) =
                  DATE_TRUNC('${trunc}', u.created_at) + INTERVAL '${i} ${trunc}s'
          ), 0) AS m${i}_revenue,
          COUNT(DISTINCT p.user_id) FILTER (
            WHERE DATE_TRUNC('${trunc}', p.created_at) =
                  DATE_TRUNC('${trunc}', u.created_at) + INTERVAL '${i} ${trunc}s'
          ) AS m${i}_users`
        ).join(',')}
      FROM users u
      LEFT JOIN payments p ON p.user_id = u.id
        AND p.type = 'challenge_fee' AND p.status = 'completed'
      WHERE u.created_at >= NOW() - INTERVAL '12 ${trunc}s'
      GROUP BY 1
      ORDER BY 1 DESC
    `);
    return reply.send({ rows, granularity });
  });
}
