import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listPayments, getPaymentStats,
  listPayoutRequests, approvePayoutRequest, rejectPayoutRequest,
} from './payments.service.js';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (_req, reply) =>
    reply.send(await getPaymentStats()),
  );

  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listPayments({
      page:   parseInt(q.page  ?? '1',  10),
      limit:  parseInt(q.limit ?? '25', 10),
      userId: q.userId, status: q.status,
      type:   q.type,   from:   q.from, to: q.to,
    }));
  });

  app.get('/payouts', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listPayoutRequests({
      page:   parseInt(q.page  ?? '1',  10),
      limit:  parseInt(q.limit ?? '25', 10),
      status: q.status,
    }));
  });

  app.post('/payouts/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    await approvePayoutRequest(id, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.post('/payouts/:id/reject', async (req, reply) => {
    const { id }     = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await rejectPayoutRequest(id, (req as any).admin.id, reason);
    return reply.send({ ok: true });
  });
}
