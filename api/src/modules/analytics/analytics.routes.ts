import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  // Overview stats
  app.get('/overview', async (_req, reply) => {
    const [users, challenges, payouts, revenue] = await Promise.all([
      queryOne<any>("SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > NOW()-INTERVAL '30 days' THEN 1 END) as last_30 FROM users"),
      queryOne<any>("SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > NOW()-INTERVAL '30 days' THEN 1 END) as last_30 FROM trading_accounts"),
      queryOne<any>("SELECT COUNT(*) as total, COALESCE(SUM(amount),0) as total_amount, AVG(EXTRACT(EPOCH FROM (updated_at-created_at))/60) as avg_minutes FROM payout_requests WHERE status='paid'"),
      queryOne<any>("SELECT COALESCE(SUM(CASE WHEN p.created_at > NOW()-INTERVAL '30 days' THEN p.amount ELSE 0 END),0) as last_30, COALESCE(SUM(p.amount),0) as all_time FROM payments p WHERE p.type='challenge_fee' AND p.status='completed'"),
    ]);
    return reply.send({ users, challenges, payouts, revenue });
  });

  // Revenue over time
  app.get('/revenue', async (req, reply) => {
    const { period = '30d' } = req.query as any;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    const rows = await query(
      `SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as orders, COALESCE(SUM(fee),0) as revenue
       FROM trading_accounts WHERE created_at > NOW()-INTERVAL '1 day' * ${days}
       GROUP BY 1 ORDER BY 1`,
      []
    );
    return reply.send(rows);
  });

  // Pass rate by challenge type
  app.get('/pass-rates', async (_req, reply) => {
    const rows = await query(
      `SELECT p.name as product, COUNT(ca.*) as total,
        COUNT(CASE WHEN ca.status IN ('passed','funded') THEN 1 END) as passed,
        ROUND(COUNT(CASE WHEN ca.status IN ('passed','funded') THEN 1 END)::numeric / NULLIF(COUNT(*),0) * 100, 1) as pass_rate
       FROM trading_accounts ca LEFT JOIN challenge_products p ON p.id=ca.challenge_product_id
       GROUP BY p.id, p.name ORDER BY total DESC`
    );
    return reply.send(rows);
  });

  // Trader cohorts
  app.get('/cohorts', async (_req, reply) => {
    const rows = await query(
      `SELECT country_code, COUNT(*) as traders, COUNT(CASE WHEN kyc_status='approved' THEN 1 END) as kyc_approved
       FROM users GROUP BY country_code ORDER BY traders DESC LIMIT 20`
    );
    return reply.send(rows);
  });

  // Payout analytics
  app.get('/payouts', async (_req, reply) => {
    const rows = await query(
      `SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as count, COALESCE(SUM(amount),0) as amount,
        AVG(EXTRACT(EPOCH FROM (updated_at-created_at))/60) as avg_minutes
       FROM payout_requests WHERE status='paid' AND created_at > NOW()-INTERVAL '90 days'
       GROUP BY 1 ORDER BY 1`
    );
    const methods = await query(
      "SELECT withdrawal_method as payment_method, COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM payout_requests WHERE status='paid' GROUP BY withdrawal_method"
    );
    return reply.send({ timeline: rows, methods });
  });

  // Platform health
  app.get('/platform-health', async (_req, reply) => {
    const rows = await query(
      `SELECT DISTINCT ON (platform) platform, status, response_ms, error_msg, checked_at
       FROM platform_health_log ORDER BY platform, checked_at DESC`
    );
    return reply.send(rows);
  });

  // Fraud flags
  app.get('/fraud-flags', async (_req, reply) => {
    const rows = await query(
      `SELECT ff.*, u.email, u.first_name, u.last_name FROM fraud_flags ff JOIN users u ON u.id=ff.user_id WHERE ff.status='open' ORDER BY ff.created_at DESC LIMIT 100`
    );
    return reply.send(rows);
  });

  app.patch('/fraud-flags/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    const admin = (req as any).admin;
    await query('UPDATE fraud_flags SET status=$1, reviewed_by=$2 WHERE id=$3', [status, admin.id, id]);
    return reply.send({ ok: true });
  });
}
