import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function faqRoutes(app: FastifyInstance) {
  app.get('/public', async (req, reply) => {
    const page = (req.query as any).page ?? 'general';
    const rows = await query('SELECT id, question, answer, sort_order FROM faq_items WHERE enabled=true AND page=$1 ORDER BY sort_order ASC', [page]);
    return reply.send(rows);
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM faq_items ORDER BY page, sort_order');
    return reply.send(rows);
  });

  app.post('/', async (req, reply) => {
    const { page, question, answer, sort_order, enabled } = req.body as any;
    const admin = (req as any).admin;
    const row = await queryOne(
      'INSERT INTO faq_items (page,question,answer,sort_order,enabled,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [page ?? 'general', question, answer, sort_order ?? 0, enabled ?? true, admin.id]
    );
    return reply.status(201).send(row);
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { question, answer, sort_order, enabled } = req.body as any;
    await query(
      'UPDATE faq_items SET question=COALESCE($1,question), answer=COALESCE($2,answer), sort_order=COALESCE($3,sort_order), enabled=COALESCE($4,enabled), updated_at=NOW() WHERE id=$5',
      [question ?? null, answer ?? null, sort_order ?? null, enabled ?? null, id]
    );
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    await query('DELETE FROM faq_items WHERE id=$1', [(req.params as any).id]);
    return reply.send({ ok: true });
  });

  app.post('/reorder', async (req, reply) => {
    const { items } = req.body as { items: { id: string; sort_order: number }[] };
    for (const item of items) {
      await query('UPDATE faq_items SET sort_order=$1 WHERE id=$2', [item.sort_order, item.id]);
    }
    return reply.send({ ok: true });
  });
}
