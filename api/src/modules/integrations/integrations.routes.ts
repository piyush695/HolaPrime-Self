import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listIntegrations, getIntegration, createIntegration,
  updateIntegration, deleteIntegration, testFireIntegration,
  getEventStats, INTERNAL_EVENTS,
} from './event-bus.js';

export async function integrationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats',  async (_req, reply) => reply.send(await getEventStats()));
  app.get('/events', async (_req, reply) => reply.send(INTERNAL_EVENTS));
  app.get('/',       async (_req, reply) => reply.send(await listIntegrations()));

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const i = await getIntegration(id);
    if (!i) return reply.status(404).send({ error: 'Not found' });
    return reply.send(i);
  });

  app.post('/', async (req, reply) => {
    const body = z.object({
      name:      z.string().min(1),
      type:      z.string(),
      config:    z.record(z.unknown()),
      eventMap:  z.record(z.string()),
      fieldMap:  z.record(z.string()).optional(),
      isActive:  z.boolean().optional(),
    }).parse(req.body);

    const id = await createIntegration(body, (req as any).admin.id);
    return reply.status(201).send({ id });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await updateIntegration(id, req.body as Parameters<typeof updateIntegration>[1]);
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteIntegration(id);
    return reply.send({ ok: true });
  });

  app.post('/:id/test', async (req, reply) => {
    const { id }    = req.params as { id: string };
    const { event } = z.object({ event: z.string() }).parse(req.body);
    const result    = await testFireIntegration(id, event);
    return reply.send(result);
  });
}
