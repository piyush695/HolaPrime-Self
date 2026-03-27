import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listEndpoints, createEndpoint, updateEndpoint,
  deleteEndpoint, pingEndpoint, getDeliveries,
} from './webhooks.service.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/',     async (_req, reply) => reply.send(await listEndpoints()));

  app.post('/', async (req, reply) => {
    const body = z.object({
      name:       z.string().min(1),
      url:        z.string().url(),
      events:     z.array(z.string()).min(1),
      headers:    z.record(z.string()).optional(),
      retryCount: z.number().int().min(1).max(10).optional(),
    }).parse(req.body);
    const id = await createEndpoint(body, (req as any).admin.id);
    return reply.status(201).send({ id });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await updateEndpoint(id, req.body as Parameters<typeof updateEndpoint>[1], (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteEndpoint(id);
    return reply.send({ ok: true });
  });

  app.post('/:id/ping', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok     = await pingEndpoint(id);
    return reply.send({ ok });
  });

  app.get('/:id/deliveries', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q      = req.query as Record<string, string>;
    return reply.send(await getDeliveries(id, parseInt(q.page ?? '1', 10), parseInt(q.limit ?? '25', 10)));
  });
}
