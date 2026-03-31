import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

async function getPlatformSnapshot() {
  const [overview, passRates, funnel, geo, retention, churnRisk, fraudFlags, payouts7d, topCampaigns, revenue7d] = await Promise.all([
    queryOne(`
      SELECT
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT u.id) FILTER (WHERE u.created_at > NOW()-INTERVAL '7 days') AS new_users_7d,
        COUNT(DISTINCT u.id) FILTER (WHERE u.created_at > NOW()-INTERVAL '30 days') AS new_users_30d,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.status='funded') AS funded_accounts,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.status='active') AS active_accounts,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.breached_at > NOW()-INTERVAL '30 days') AS breached_30d,
        COALESCE(SUM(p.amount) FILTER (WHERE p.type='challenge_fee' AND p.status='completed' AND p.created_at > NOW()-INTERVAL '30 days'),0) AS revenue_30d,
        COALESCE(SUM(pr.amount) FILTER (WHERE pr.status='paid' AND pr.paid_at > NOW()-INTERVAL '30 days'),0) AS payouts_30d,
        COUNT(DISTINCT u.id) FILTER (WHERE u.kyc_status='pending') AS kyc_pending
      FROM users u
      LEFT JOIN trading_accounts ta ON ta.user_id=u.id
      LEFT JOIN payments p ON p.user_id=u.id
      LEFT JOIN payout_requests pr ON pr.user_id=u.id
    `),
    query(`
      SELECT cp.name as product, COUNT(ta.id) as total,
        COUNT(ta.id) FILTER (WHERE ta.status IN ('passed','funded')) as passed,
        ROUND(COUNT(ta.id) FILTER (WHERE ta.status IN ('passed','funded'))::numeric/NULLIF(COUNT(ta.id),0)*100,1) as pass_rate_pct
      FROM challenge_products cp LEFT JOIN trading_accounts ta ON ta.product_id=cp.id
      GROUP BY cp.name ORDER BY total DESC LIMIT 5
    `),
    queryOne(`
      SELECT
        (SELECT COUNT(*) FROM users) as registered,
        (SELECT COUNT(DISTINCT user_id) FROM payments WHERE type='challenge_fee' AND status='completed') as purchased,
        (SELECT COUNT(DISTINCT user_id) FROM trading_accounts WHERE status IN ('passed','funded')) as passed,
        (SELECT COUNT(DISTINCT user_id) FROM trading_accounts WHERE status='funded') as funded,
        (SELECT COUNT(DISTINCT user_id) FROM payout_requests WHERE status='paid') as paid_out
    `),
    query(`SELECT country_code, COUNT(*) as users FROM users WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY users DESC LIMIT 10`),
    queryOne(`
      SELECT COUNT(DISTINCT user_id) as repeat_buyers,
        ROUND(COUNT(DISTINCT user_id)::numeric/NULLIF((SELECT COUNT(DISTINCT user_id) FROM payments WHERE type='challenge_fee' AND status='completed'),0)*100,1) as repeat_rate_pct
      FROM (SELECT user_id FROM payments WHERE type='challenge_fee' AND status='completed' GROUP BY user_id HAVING COUNT(*)>1) sub
    `),
    queryOne(`SELECT COUNT(DISTINCT ta.user_id) as at_risk FROM trading_accounts ta WHERE ta.status='active' AND (ta.last_sync_at IS NULL OR ta.last_sync_at < NOW()-INTERVAL '7 days')`),
    queryOne(`SELECT COUNT(*) as open FROM fraud_flags WHERE status='open'`),
    queryOne(`SELECT COUNT(*) as count_7d, COALESCE(SUM(amount),0) as amount_7d FROM payout_requests WHERE status='paid' AND paid_at > NOW()-INTERVAL '7 days'`),
    query(`SELECT name, type, status, sent_count, open_count, click_count FROM campaigns WHERE status='completed' ORDER BY created_at DESC LIMIT 5`),
    query(`SELECT DATE(created_at) as date, COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders FROM payments WHERE type='challenge_fee' AND status='completed' AND created_at > NOW()-INTERVAL '7 days' GROUP BY 1 ORDER BY 1`),
  ]);
  return { overview, passRates, funnel, geo, retention, churnRisk, fraudFlags, payouts7d, topCampaigns, revenue7d };
}

function buildContext(snapshot: any): string {
  const o = snapshot.overview as any ?? {};
  const f = snapshot.funnel as any ?? {};
  const r = snapshot.retention as any ?? {};
  const reg = Number(f.registered ?? 0);
  const pur = Number(f.purchased ?? 0);
  const pas = Number(f.passed ?? 0);
  const fun = Number(f.funded ?? 0);
  const pai = Number(f.paid_out ?? 0);
  return `## Hola Prime — Live Platform Snapshot

### Core KPIs
- Total users: ${Number(o.total_users??0).toLocaleString()} | +${o.new_users_7d??0} last 7d | +${o.new_users_30d??0} last 30d
- Active challenge accounts: ${o.active_accounts??0} | Funded: ${o.funded_accounts??0}
- Revenue last 30d: $${Number(o.revenue_30d??0).toLocaleString()} | Payouts last 30d: $${Number(o.payouts_30d??0).toLocaleString()}
- Accounts breached last 30d: ${o.breached_30d??0} | KYC pending: ${o.kyc_pending??0}
- Repeat buyers: ${r.repeat_buyers??0} (${r.repeat_rate_pct??0}%) | Churn risk (inactive 7d+): ${(snapshot.churnRisk as any)?.at_risk??0}
- Open fraud flags: ${(snapshot.fraudFlags as any)?.open??0}
- Payouts last 7d: ${(snapshot.payouts7d as any)?.count_7d??0} worth $${Number((snapshot.payouts7d as any)?.amount_7d??0).toLocaleString()}

### Conversion Funnel
Registered (${reg}) → Purchased (${pur}, ${reg>0?((pur/reg)*100).toFixed(1):0}%) → Passed (${pas}, ${pur>0?((pas/pur)*100).toFixed(1):0}%) → Funded (${fun}) → Paid Out (${pai})

### Pass Rates by Product
${(snapshot.passRates as any[]??[]).map((p:any)=>`- ${p.product}: ${p.total} accounts, ${p.pass_rate_pct}% pass rate`).join('\n')||'No data'}

### Top Countries
${(snapshot.geo as any[]??[]).slice(0,5).map((g:any)=>`- ${g.country_code}: ${g.users} users`).join('\n')||'No data'}

### Revenue Last 7 Days
${(snapshot.revenue7d as any[]??[]).map((r:any)=>`- ${r.date}: $${Number(r.revenue).toLocaleString()} (${r.orders} orders)`).join('\n')||'No data'}

### Campaign Performance (Recent)
${(snapshot.topCampaigns as any[]??[]).map((c:any)=>`- "${c.name}" (${c.type}): ${c.sent_count} sent, ${c.open_count} opens, ${c.click_count} clicks`).join('\n')||'No campaigns yet'}`;
}

export async function aiInsightsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  app.get('/snapshot', async (_req, reply) => {
    try { return reply.send(await getPlatformSnapshot()); }
    catch(e) { return reply.status(500).send({ error: String(e) }); }
  });

  app.post('/analyse', async (req, reply) => {
    const { question, conversationHistory = [] } = req.body as { question: string; conversationHistory: Array<{role:'user'|'assistant';content:string}> };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return reply.status(503).send({ error: 'ANTHROPIC_API_KEY not set. Add it to Cloud Run → holaprime-admin → Variables & Secrets.' });

    let snapshot: any = {};
    try { snapshot = await getPlatformSnapshot(); } catch(e) { snapshot.error = String(e); }

    const isFirst = conversationHistory.length === 0;
    const userContent = isFirst ? `${buildContext(snapshot)}\n\n---\n\n${question}` : question;
    const messages = [...conversationHistory, { role: 'user' as const, content: userContent }];

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    try {
      const res = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: CLAUDE_MODEL, max_tokens: 2048, stream: true,
          system: `You are a sharp marketing and growth analyst for Hola Prime, a prop trading firm. You have live platform data. Be concise, specific with numbers, and lead with the most critical insight. Use ❗ for urgent issues and ✅ for positive trends. Give 3-5 prioritised action recommendations. Format with markdown.`,
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as any;
        reply.raw.write(`data: ${JSON.stringify({ type:'error', error: err.error?.message ?? `API error ${res.status}` })}\n\n`);
        reply.raw.end(); return;
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            reply.raw.write(`${line}\n\n`);
          }
        }
      }
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch(e) {
      reply.raw.write(`data: ${JSON.stringify({ type:'error', error: String(e) })}\n\n`);
      reply.raw.end();
    }
  });
}
