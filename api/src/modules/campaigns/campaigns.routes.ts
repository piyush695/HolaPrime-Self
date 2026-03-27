import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listCampaigns, getCampaignDetail, createCampaign, launchCampaign,
  listTemplates, getTemplate, upsertTemplate, getCampaignStats,
} from './campaigns.service.js';

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats',     async (_req, reply) => reply.send(await getCampaignStats()));

  // Campaigns
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listCampaigns({
      page:   parseInt(q.page  ?? '1',  10),
      limit:  parseInt(q.limit ?? '25', 10),
      status: q.status, type: q.type,
    }));
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = await getCampaignDetail(id);
    if (!c) return reply.status(404).send({ error: 'Not found' });
    return reply.send(c);
  });

  app.post('/', async (req, reply) => {
    const id = await createCampaign({
      ...(req.body as Parameters<typeof createCampaign>[0]),
      adminId: (req as any).admin.id,
    });
    return reply.status(201).send({ id });
  });

  app.post('/:id/launch', async (req, reply) => {
    const { id } = req.params as { id: string };
    const count  = await launchCampaign(id, (req as any).admin.id);
    return reply.send({ ok: true, queued: count });
  });

  // Templates
  app.get('/templates', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listTemplates(q.category));
  });

  app.get('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const t = await getTemplate(id);
    if (!t) return reply.status(404).send({ error: 'Not found' });
    return reply.send(t);
  });

  app.put('/templates/:id?', async (req, reply) => {
    const { id } = req.params as { id?: string };
    const tid = await upsertTemplate({
      id,
      ...(req.body as Parameters<typeof upsertTemplate>[0]),
      adminId: (req as any).admin.id,
    });
    return reply.send({ id: tid });
  });
}
