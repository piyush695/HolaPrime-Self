import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function testimonialsRoutes(app: FastifyInstance) {
  app.get('/public', async (_req, reply) => {
    const rows = await query('SELECT id, trader_name, country, country_flag, payout_amount, quote, rating, verified, featured FROM testimonials WHERE enabled=true ORDER BY featured DESC, sort_order ASC');
    return reply.send(rows);
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM testimonials ORDER BY sort_order, created_at DESC');
    return reply.send(rows);
  });

  app.post('/', async (req, reply) => {
    const { trader_name, country, country_flag, payout_amount, quote, rating, verified, featured, sort_order } = req.body as any;
    const admin = (req as any).admin;
    const row = await queryOne(
      'INSERT INTO testimonials (trader_name,country,country_flag,payout_amount,quote,rating,verified,featured,sort_order,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [trader_name, country, country_flag ?? '🌍', payout_amount ?? null, quote, rating ?? 5, verified ?? false, featured ?? false, sort_order ?? 0, admin.id]
    );
    return reply.status(201).send(row);
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { trader_name, country, country_flag, payout_amount, quote, rating, verified, featured, enabled, sort_order } = req.body as any;
    await query(
      `UPDATE testimonials SET 
        trader_name=COALESCE($1,trader_name), country=COALESCE($2,country), country_flag=COALESCE($3,country_flag),
        payout_amount=COALESCE($4,payout_amount), quote=COALESCE($5,quote), rating=COALESCE($6,rating),
        verified=COALESCE($7,verified), featured=COALESCE($8,featured), enabled=COALESCE($9,enabled), sort_order=COALESCE($10,sort_order)
       WHERE id=$11`,
      [trader_name ?? null, country ?? null, country_flag ?? null, payout_amount ?? null, quote ?? null, rating ?? null, verified ?? null, featured ?? null, enabled ?? null, sort_order ?? null, id]
    );
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    await query('UPDATE testimonials SET enabled=false WHERE id=$1', [(req.params as any).id]);
    return reply.send({ ok: true });
  });
}
