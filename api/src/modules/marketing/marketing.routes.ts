import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function marketingRoutes(app: FastifyInstance) {

  // ── Public: Social Proof feed (for landing page) ────────────────────────────
  app.get('/social-proof/public', async (req, reply) => {
    const limit = Math.min(parseInt((req.query as any).limit ?? '20'), 50);
    const rows = await query(
      `SELECT event_type, trader_name, trader_country, trader_flag, amount, challenge_name, platform, occurred_at
       FROM social_proof_events WHERE is_visible=true ORDER BY occurred_at DESC LIMIT $1`,
      [limit]
    );
    return reply.send(rows);
  });

  // Admin auth for everything below
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/public')) return;
    return app.authenticate(req, reply);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FEATURE 3 — Re-engagement Triggers
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/reengagement', async (_req, reply) => {
    const rows = await query('SELECT * FROM reengagement_triggers ORDER BY trigger_event, delay_hours');
    return reply.send(rows);
  });

  app.post('/reengagement', async (req, reply) => {
    const d = req.body as any;
    const admin = (req as any).admin;
    const row = await queryOne(
      `INSERT INTO reengagement_triggers
         (name, description, trigger_event, delay_hours, channel, subject, message_body, enabled, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [d.name, d.description ?? null, d.trigger_event, d.delay_hours ?? 0,
       d.channel ?? 'email', d.subject ?? null, d.message_body, d.enabled ?? true, admin.id]
    );
    return reply.status(201).send(row);
  });

  app.patch('/reengagement/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const d = req.body as any;
    await query(
      `UPDATE reengagement_triggers SET name=$1,description=$2,trigger_event=$3,delay_hours=$4,
        channel=$5,subject=$6,message_body=$7,enabled=$8,updated_at=NOW() WHERE id=$9`,
      [d.name, d.description ?? null, d.trigger_event, d.delay_hours,
       d.channel, d.subject ?? null, d.message_body, d.enabled, id]
    );
    return reply.send({ ok: true });
  });

  app.delete('/reengagement/:id', async (req, reply) => {
    await query('UPDATE reengagement_triggers SET enabled=false WHERE id=$1', [(req.params as any).id]);
    return reply.send({ ok: true });
  });

  // Trigger sends log
  app.get('/reengagement/:id/sends', async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await query(
      `SELECT rs.*, u.email, u.first_name, u.last_name
       FROM reengagement_sends rs JOIN users u ON u.id=rs.user_id
       WHERE rs.trigger_id=$1 ORDER BY rs.created_at DESC LIMIT 200`,
      [id]
    );
    const stats = await queryOne<any>(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status='sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status='opened' THEN 1 END) as opened,
        COUNT(CASE WHEN status='converted' THEN 1 END) as converted
       FROM reengagement_sends WHERE trigger_id=$1`, [id]
    );
    return reply.send({ sends: rows, stats });
  });

  // Test send a trigger
  app.post('/reengagement/:id/test', async (req, reply) => {
    const { email } = req.body as { email: string };
    return reply.send({ ok: true, message: `Test would send to ${email} when email is configured` });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FEATURE 4 — LTV by Channel
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/ltv', async (req, reply) => {
    const { period = '90d' } = req.query as any;
    const days = period === '30d' ? 30 : period === '1y' ? 365 : 90;

    // LTV by acquisition channel (from ad_clicks)
    const byChannel = await query(`
      SELECT
        COALESCE(ac.channel, 'direct') as channel,
        COUNT(DISTINCT u.id) as traders,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COALESCE(AVG(p.amount), 0) as avg_ltv,
        COUNT(DISTINCT p.id) as purchases,
        COALESCE(SUM(pr.trader_amount), 0) as total_payouts,
        COUNT(DISTINCT CASE WHEN ta.status IN ('passed','funded') THEN u.id END) as funded_traders
      FROM users u
      LEFT JOIN ad_clicks ac ON ac.user_id = u.id
      LEFT JOIN payments p ON p.user_id = u.id AND p.type='challenge_fee' AND p.status='completed'
      LEFT JOIN payout_requests pr ON pr.user_id = u.id AND pr.status='paid'
      LEFT JOIN trading_accounts ta ON ta.user_id = u.id
      WHERE u.created_at > NOW() - INTERVAL '1 day' * ${days}
      GROUP BY COALESCE(ac.channel, 'direct')
      ORDER BY total_revenue DESC
    `);

    // Top traders by LTV
    const topTraders = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.country_code,
        COALESCE(SUM(p.amount), 0) as total_spent,
        COALESCE(SUM(pr.trader_amount), 0) as total_received,
        COUNT(DISTINCT p.id) as purchases,
        COALESCE(ac.channel, 'direct') as channel,
        ac.utm_campaign
      FROM users u
      LEFT JOIN payments p ON p.user_id=u.id AND p.type='challenge_fee' AND p.status='completed'
      LEFT JOIN payout_requests pr ON pr.user_id=u.id AND pr.status='paid'
      LEFT JOIN LATERAL (
        SELECT channel, utm_campaign FROM ad_clicks WHERE user_id=u.id ORDER BY created_at ASC LIMIT 1
      ) ac ON true
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.country_code, ac.channel, ac.utm_campaign
      HAVING COALESCE(SUM(p.amount), 0) > 0
      ORDER BY total_spent DESC LIMIT 50
    `);

    // Revenue cohorts (monthly join cohort vs LTV)
    const cohorts = await query(`
      SELECT
        DATE_TRUNC('month', u.created_at) as cohort_month,
        COUNT(DISTINCT u.id) as traders,
        COALESCE(SUM(p.amount), 0) as revenue_m0,
        COALESCE(AVG(p.amount), 0) as avg_order_value
      FROM users u
      LEFT JOIN payments p ON p.user_id=u.id AND p.type='challenge_fee' AND p.status='completed'
        AND p.created_at < u.created_at + INTERVAL '30 days'
      WHERE u.created_at > NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', u.created_at)
      ORDER BY cohort_month DESC
    `);

    return reply.send({ byChannel, topTraders, cohorts });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FEATURE 5 — Conversion Funnel
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/funnel', async (req, reply) => {
    const { from, to, channel, campaign } = req.query as any;
    const fromDate = from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate   = to   ?? new Date().toISOString().split('T')[0];

    // Build channel filter
    let clickJoin = '';
    let clickWhere = '';
    const vals: any[] = [fromDate, toDate];
    if (channel) {
      vals.push(channel);
      clickJoin  = `LEFT JOIN ad_clicks ac ON ac.user_id=u.id`;
      clickWhere = `AND (ac.channel=$${vals.length} OR (ac.channel IS NULL AND $${vals.length}='direct'))`;
    }
    if (campaign) {
      vals.push(campaign);
      if (!clickJoin) clickJoin = `LEFT JOIN ad_clicks ac ON ac.user_id=u.id`;
      clickWhere += ` AND ac.utm_campaign=$${vals.length}`;
    }

    const steps = await query(`
      WITH base AS (
        SELECT u.id, u.created_at, u.kyc_status,
          MAX(CASE WHEN p.type='challenge_fee' AND p.status='completed' THEN 1 ELSE 0 END) as purchased,
          MAX(CASE WHEN ta.status IN ('passed','funded') THEN 1 ELSE 0 END) as passed,
          MAX(CASE WHEN ta.status='funded' THEN 1 ELSE 0 END) as funded,
          MAX(CASE WHEN pr.status='paid' THEN 1 ELSE 0 END) as paid_out
        FROM users u
        ${clickJoin}
        LEFT JOIN payments p ON p.user_id=u.id
        LEFT JOIN trading_accounts ta ON ta.user_id=u.id
        LEFT JOIN payout_requests pr ON pr.user_id=u.id
        WHERE u.created_at BETWEEN $1 AND $2::date + INTERVAL '1 day'
        ${clickWhere}
        GROUP BY u.id, u.created_at, u.kyc_status
      )
      SELECT
        COUNT(*) as registered,
        COUNT(CASE WHEN purchased=1 THEN 1 END) as purchased,
        COUNT(CASE WHEN passed=1 THEN 1 END) as passed,
        COUNT(CASE WHEN kyc_status='approved' THEN 1 END) as kyc_approved,
        COUNT(CASE WHEN funded=1 THEN 1 END) as funded,
        COUNT(CASE WHEN paid_out=1 THEN 1 END) as paid_out
      FROM base
    `, vals);

    // Daily breakdown of registrations + purchases
    const daily = await query(`
      SELECT
        DATE_TRUNC('day', u.created_at) as date,
        COUNT(DISTINCT u.id) as registrations,
        COUNT(DISTINCT p.user_id) as purchases
      FROM users u
      LEFT JOIN payments p ON p.user_id=u.id AND p.type='challenge_fee' AND p.status='completed'
        AND DATE_TRUNC('day', p.created_at)=DATE_TRUNC('day', u.created_at)
      WHERE u.created_at BETWEEN $1 AND $2::date + INTERVAL '1 day'
      GROUP BY 1 ORDER BY 1
    `, [fromDate, toDate]);

    // Drop-off reasons (breach types)
    const dropoffs = await query(`
      SELECT breach_type, COUNT(*) as count
      FROM trading_accounts WHERE breached_at IS NOT NULL
        AND created_at BETWEEN $1 AND $2::date + INTERVAL '1 day'
      GROUP BY breach_type ORDER BY count DESC
    `, [fromDate, toDate]);

    const s = (steps as any[])[0] ?? {};
    const funnel = [
      { stage:'Visited & Registered', count:parseInt(s.registered??0), color:'#4F8CF7' },
      { stage:'Purchased a Challenge', count:parseInt(s.purchased??0), color:'#8B5CF6' },
      { stage:'Passed Challenge',      count:parseInt(s.passed??0),    color:'#F59E0B' },
      { stage:'KYC Approved',          count:parseInt(s.kyc_approved??0), color:'#10B981' },
      { stage:'Funded Account',        count:parseInt(s.funded??0),    color:'#06B6D4' },
      { stage:'First Payout',          count:parseInt(s.paid_out??0),  color:'#38BA82' },
    ].map((step, i, arr) => ({
      ...step,
      pct_of_prev: i === 0 ? 100 : arr[0].count > 0 ? parseFloat(((step.count / arr[0].count) * 100).toFixed(1)) : 0,
      dropoff: i > 0 ? arr[i-1].count - step.count : 0,
    }));

    return reply.send({ funnel, daily, dropoffs });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FEATURE 6 — Geo Heatmap
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/geo', async (req, reply) => {
    const { metric = 'signups', period = '30d' } = req.query as any;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;

    const signups = await query(`
      SELECT
        COALESCE(u.country_code, 'XX') as country_code,
        COUNT(DISTINCT u.id) as signups,
        COUNT(DISTINCT p.user_id) as purchases,
        COALESCE(SUM(p.amount), 0) as revenue,
        COUNT(DISTINCT CASE WHEN ta.status IN ('passed','funded') THEN u.id END) as funded,
        COUNT(DISTINCT pr.user_id) as payouts,
        COALESCE(SUM(pr.trader_amount), 0) as payout_amount,
        ROUND(COUNT(DISTINCT p.user_id)::numeric / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 1) as conv_rate
      FROM users u
      LEFT JOIN payments p ON p.user_id=u.id AND p.type='challenge_fee' AND p.status='completed'
      LEFT JOIN trading_accounts ta ON ta.user_id=u.id
      LEFT JOIN payout_requests pr ON pr.user_id=u.id AND pr.status='paid'
      WHERE u.created_at > NOW() - INTERVAL '1 day' * ${days}
      GROUP BY country_code ORDER BY signups DESC
    `);

    // Top 20 cities (from IP-derived country)
    const topCountries = (signups as any[]).slice(0, 20);

    // Traffic vs conversion by country
    const heatmapData = (signups as any[]).map(r => ({
      ...r,
      intensity: Math.min(parseInt(r.signups) / Math.max(...(signups as any[]).map((x: any) => parseInt(x.signups))), 1),
    }));

    return reply.send({ countries: heatmapData, topCountries });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FEATURE 8 — Social Proof Feed (Admin management)
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/social-proof', async (_req, reply) => {
    const rows = await query('SELECT * FROM social_proof_events ORDER BY occurred_at DESC LIMIT 200');
    return reply.send(rows);
  });

  // Auto-generate social proof from real payouts
  app.post('/social-proof/generate', async (req, reply) => {
    const admin = (req as any).admin;
    const { days = 30, anonymise = true } = req.body as any;

    const payouts = await query(`
      SELECT u.first_name, u.last_name, u.country_code,
        pr.trader_amount as amount, cp.name as challenge_name, ta.platform
      FROM payout_requests pr
      JOIN users u ON u.id=pr.user_id
      JOIN trading_accounts ta ON ta.id=pr.account_id
      JOIN challenge_products cp ON cp.id=ta.product_id
      WHERE pr.status='paid' AND pr.paid_at > NOW() - INTERVAL '1 day' * ${days}
      ORDER BY pr.paid_at DESC LIMIT 100
    `);

    const FLAG_MAP: Record<string,string> = {
      GB:'🇬🇧',US:'🇺🇸',IN:'🇮🇳',AE:'🇦🇪',DE:'🇩🇪',FR:'🇫🇷',
      AU:'🇦🇺',CA:'🇨🇦',SG:'🇸🇬',ZA:'🇿🇦',NG:'🇳🇬',KE:'🇰🇪',
      BR:'🇧🇷',MX:'🇲🇽',PK:'🇵🇰',PH:'🇵🇭',MY:'🇲🇾',TH:'🇹🇭',
    };

    let inserted = 0;
    for (const p of payouts as any[]) {
      const displayName = anonymise
        ? `${p.first_name} ${p.last_name?.[0] ?? ''}`.trim()
        : `${p.first_name} ${p.last_name}`;

      await query(
        `INSERT INTO social_proof_events (event_type, trader_name, trader_country, trader_flag, amount, challenge_name, platform, occurred_at)
         VALUES ('payout', $1, $2, $3, $4, $5, $6, NOW() - (RANDOM() * INTERVAL '1 day' * ${days}))
         ON CONFLICT DO NOTHING`,
        [displayName, p.country_code ?? null, FLAG_MAP[p.country_code] ?? '🌍',
         parseFloat(p.amount), p.challenge_name, p.platform ?? null]
      ).catch(() => {});
      inserted++;
    }

    return reply.send({ ok: true, inserted });
  });

  app.post('/social-proof', async (req, reply) => {
    const d = req.body as any;
    const row = await queryOne(
      `INSERT INTO social_proof_events (event_type, trader_name, trader_country, trader_flag, amount, challenge_name, is_visible, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [d.event_type, d.trader_name, d.trader_country ?? null, d.trader_flag ?? '🌍',
       d.amount ?? null, d.challenge_name ?? null, d.is_visible ?? true, d.is_verified ?? true]
    );
    return reply.status(201).send(row);
  });

  app.patch('/social-proof/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { is_visible } = req.body as any;
    await query('UPDATE social_proof_events SET is_visible=$1 WHERE id=$2', [is_visible, id]);
    return reply.send({ ok: true });
  });

  app.delete('/social-proof/:id', async (req, reply) => {
    await query('DELETE FROM social_proof_events WHERE id=$1', [(req.params as any).id]);
    return reply.send({ ok: true });
  });
}
