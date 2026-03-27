import type { FastifyInstance } from 'fastify';
import {
  getActiveRiskEvents, acknowledgeRiskEvent,
  getRiskStats, checkAccountRisk,
} from './risk.service.js';

export async function riskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (_req, reply) =>
    reply.send(await getRiskStats()),
  );

  app.get('/events', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await getActiveRiskEvents({
      page:         parseInt(q.page  ?? '1',  10),
      limit:        parseInt(q.limit ?? '25', 10),
      severity:     q.severity,
      acknowledged: q.acknowledged === 'true' ? true
                  : q.acknowledged === 'false' ? false
                  : undefined,
    }));
  });

  app.post('/events/:id/acknowledge', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acknowledgeRiskEvent(id, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.post('/accounts/:id/scan', async (req, reply) => {
    const { id } = req.params as { id: string };
    await checkAccountRisk(id);
    return reply.send({ ok: true });
  });
}
