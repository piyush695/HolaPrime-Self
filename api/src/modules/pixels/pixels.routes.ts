import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listPixels, getPixel, createPixel, updatePixel, deletePixel,
  getActivePixels, getEventParams, upsertEventParam, deleteEventParam,
} from './pixels.service.js';

export async function pixelsRoutes(app: FastifyInstance): Promise<void> {

  // ── Public: trader app fetches active pixels to inject ───────────────────
  app.get('/public', async (req, reply) => {
    const { page } = req.query as { page?: string };
    const pixels = await getActivePixels(page);
    return reply.send(pixels);
  });

  // ── Admin routes (authenticated) ─────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    // Skip auth for /public route
    if ((req as any).routerPath?.endsWith('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) =>
    reply.send(await listPixels()),
  );

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const pixel = await getPixel(id);
    if (!pixel) return reply.status(404).send({ error: 'Not found' });
    return reply.send(pixel);
  });

  app.post('/', async (req, reply) => {
    const body = z.object({
      name:         z.string().min(1),
      platform:     z.string().min(1),
      pixelId:      z.string().optional(),
      extraConfig:  z.record(z.unknown()).optional(),
      customScript: z.string().optional(),
      loadOn:       z.array(z.string()).optional(),
      isActive:     z.boolean().optional(),
      fireOnEvents: z.array(z.string()).optional(),
      eventMap:     z.record(z.string()).optional(),
    }).parse(req.body);

    const id = await createPixel({ ...body, createdBy: (req as any).admin.id });
    return reply.status(201).send({ id });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name:         z.string().optional(),
      pixelId:      z.string().optional(),
      extraConfig:  z.record(z.unknown()).optional(),
      customScript: z.string().optional(),
      loadOn:       z.array(z.string()).optional(),
      isActive:     z.boolean().optional(),
      fireOnEvents: z.array(z.string()).optional(),
      eventMap:     z.record(z.string()).optional(),
    }).parse(req.body);

    await updatePixel(id, body);
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await deletePixel(id);
    return reply.send({ ok: true });
  });

  // ── Event parameter builder (per integration) ─────────────────────────────
  app.get('/:integrationId/event-params', async (req, reply) => {
    const { integrationId } = req.params as { integrationId: string };
    return reply.send(await getEventParams(integrationId));
  });

  app.put('/:integrationId/event-params', async (req, reply) => {
    const { integrationId } = req.params as { integrationId: string };
    const body = z.object({
      internalEvent: z.string(),
      externalEvent: z.string(),
      params:        z.record(z.unknown()),
      enabled:       z.boolean().optional(),
    }).parse(req.body);

    await upsertEventParam({ integrationId, ...body });
    return reply.send({ ok: true });
  });

  app.delete('/:integrationId/event-params/:event', async (req, reply) => {
    const { integrationId, event } = req.params as { integrationId: string; event: string };
    await deleteEventParam(integrationId, event);
    return reply.send({ ok: true });
  });
}
