import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listPayoutsEnhanced, getPayoutDetail, getPayoutStats,
  approvePayoutEnhanced, rejectPayoutEnhanced,
  batchApprovePayout, batchRejectPayout,
  setPriority, setInternalNote,
} from './payouts.service.js';

export async function payoutsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (_req, reply) =>
    reply.send(await getPayoutStats()),
  );

  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listPayoutsEnhanced({
      page:     parseInt(q.page  ?? '1',  10),
      limit:    parseInt(q.limit ?? '25', 10),
      status:   q.status,
      priority: q.priority,
      search:   q.search,
      from:     q.from,
      to:       q.to,
      batchId:  q.batchId,
    }));
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = await getPayoutDetail(id);
    if (!detail) return reply.status(404).send({ error: 'Not found' });
    return reply.send(detail);
  });

  app.post('/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      note: z.string().optional(),
      processedAmount: z.number().optional(),
    }).parse(req.body ?? {});
    const admin = (req as any).admin;
    await approvePayoutEnhanced(id, admin.id, admin.email, admin.role, body);
    return reply.send({ ok: true });
  });

  app.post('/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    const admin = (req as any).admin;
    await rejectPayoutEnhanced(id, admin.id, admin.email, admin.role, reason);
    return reply.send({ ok: true });
  });

  app.post('/batch/approve', async (req, reply) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
    const admin = (req as any).admin;
    const result = await batchApprovePayout(ids, admin.id, admin.email, admin.role);
    return reply.send(result);
  });

  app.post('/batch/reject', async (req, reply) => {
    const { ids, reason } = z.object({
      ids: z.array(z.string().uuid()),
      reason: z.string().min(5),
    }).parse(req.body);
    const admin = (req as any).admin;
    const result = await batchRejectPayout(ids, reason, admin.id, admin.email, admin.role);
    return reply.send(result);
  });

  app.patch('/:id/priority', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { priority } = z.object({
      priority: z.enum(['low', 'normal', 'high']),
    }).parse(req.body);
    await setPriority(id, priority);
    return reply.send({ ok: true });
  });

  app.patch('/:id/note', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { note } = z.object({ note: z.string() }).parse(req.body);
    await setInternalNote(id, note, (req as any).admin.id);
    return reply.send({ ok: true });
  });
}
