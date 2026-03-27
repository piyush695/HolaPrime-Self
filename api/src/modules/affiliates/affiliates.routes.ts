import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listAffiliates, getAffiliate, createAffiliate,
  createAffiliateLink, trackAffiliateClick, getAffiliateStats,
} from './affiliates.service.js';

export async function affiliateRoutes(app: FastifyInstance): Promise<void> {
  // Public redirect (no auth)
  app.get('/ref/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const dest = await trackAffiliateClick(
      slug, req.ip,
      req.headers['user-agent'] ?? '',
      req.headers['referer'] ?? '',
      req.headers['origin'] ?? '',
    );
    if (!dest) return reply.status(404).send({ error: 'Link not found' });
    return reply.redirect(dest);
  });

  // Admin routes
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/ref/')) return;
    return app.authenticate(req, reply);
  });

  app.get('/stats', async (_req, reply) => reply.send(await getAffiliateStats()));

  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listAffiliates({
      page:   parseInt(q.page  ?? '1',  10),
      limit:  parseInt(q.limit ?? '25', 10),
      status: q.status, search: q.search,
    }));
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const aff = await getAffiliate(id);
    if (!aff) return reply.status(404).send({ error: 'Not found' });
    return reply.send(aff);
  });

  app.post('/', async (req, reply) => {
    const body = req.body as Parameters<typeof createAffiliate>[0];
    const id   = await createAffiliate({ ...body, adminId: (req as any).admin.id });
    return reply.status(201).send({ id });
  });

  app.post('/:id/links', async (req, reply) => {
    const { id }      = req.params as { id: string };
    const { name, destinationUrl, utmCampaign } = z.object({
      name:           z.string().min(1),
      destinationUrl: z.string().url(),
      utmCampaign:    z.string().optional(),
    }).parse(req.body);
    const link = await createAffiliateLink({ affiliateId: id, name, destinationUrl, utmCampaign });
    return reply.status(201).send(link);
  });

  // ── Trader: get own affiliate data ────────────────────────────────────────
  app.get('/me', async (req, reply) => {
    let traderId: string;
    try {
      const p = await req.jwtVerify<{ sub: string; type: string }>();
      if (p.type !== 'trader') return reply.status(401).send({ error: 'Unauthorised' });
      traderId = p.sub;
    } catch { return reply.status(401).send({ error: 'Unauthorised' }); }

    const { query } = await import('../../db/index.js');
    const codes = await query(
      `SELECT ac.*, 
        COUNT(DISTINCT ar.referred_user_id) as signups,
        COUNT(DISTINCT CASE WHEN ar.converted_at IS NOT NULL THEN ar.id END) as purchases,
        COALESCE(SUM(CASE WHEN ac2.status = 'paid' THEN ac2.amount ELSE 0 END),0) as earned,
        COALESCE(SUM(CASE WHEN ac2.status = 'pending' THEN ac2.amount ELSE 0 END),0) as pending
       FROM affiliate_codes ac
       LEFT JOIN affiliate_referrals ar ON ar.code_id = ac.id
       LEFT JOIN affiliate_commissions ac2 ON ac2.affiliate_user_id = $1
       WHERE ac.user_id = $1
       GROUP BY ac.id
       LIMIT 1`,
      [traderId]
    ).catch(() => []);
    const row = (codes as any[])[0];
    if (!row) return reply.send({ code: null, stats: { clicks:0, signups:0, purchases:0, earned:0, pending:0 }, referrals: [] });
    return reply.send({
      code: row.code,
      stats: { clicks: parseInt(row.click_count??0), signups: parseInt(row.signups??0), purchases: parseInt(row.purchases??0), earned: parseFloat(row.earned??0), pending: parseFloat(row.pending??0) },
      referrals: [],
    });
  });

  // ── Trader: create custom affiliate code ───────────────────────────────────
  app.post('/code', async (req, reply) => {
    let traderId: string;
    try {
      const p = await req.jwtVerify<{ sub: string; type: string }>();
      if (p.type !== 'trader') return reply.status(401).send({ error: 'Unauthorised' });
      traderId = p.sub;
    } catch { return reply.status(401).send({ error: 'Unauthorised' }); }

    const { code } = req.body as { code: string };
    if (!code || !/^[A-Z0-9]{3,12}$/.test(code)) return reply.status(400).send({ error: 'Code must be 3–12 uppercase letters/numbers.' });
    const { query } = await import('../../db/index.js');
    const exists = await query('SELECT id FROM affiliate_codes WHERE code = $1', [code]).catch(() => []);
    if ((exists as any[]).length > 0) return reply.status(409).send({ error: 'Code already taken. Try another.' });
    await query(
      `INSERT INTO affiliate_codes (user_id, code, commission_rate, created_at)
       VALUES ($1, $2, 0.20, NOW())
       ON CONFLICT (user_id) DO UPDATE SET code = $2`,
      [traderId, code]
    ).catch(() => {});
    return reply.send({ code, ok: true });
  });

}
