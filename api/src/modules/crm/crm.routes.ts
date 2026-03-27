import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listContacts, getContact, upsertContact, addActivity,
  addNote, updateContactStatus, assignContact,
  getCRMStats, refreshAllScores,
} from './crm.service.js';

export async function crmRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (_req, reply) => reply.send(await getCRMStats()));

  app.get('/contacts', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listContacts({
      page:       parseInt(q.page  ?? '1',  10),
      limit:      parseInt(q.limit ?? '25', 10),
      search:     q.search,
      status:     q.status,
      source:     q.source,
      assignedTo: q.assignedTo,
      minScore:   q.minScore ? parseInt(q.minScore, 10) : undefined,
      tags:       q.tags?.split(','),
    }));
  });

  app.get('/contacts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = await getContact(id);
    if (!c) return reply.status(404).send({ error: 'Not found' });
    return reply.send(c);
  });

  app.post('/contacts', async (req, reply) => {
    const id = await upsertContact(req.body as Parameters<typeof upsertContact>[0]);
    return reply.status(201).send({ id });
  });

  app.patch('/contacts/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = z.object({ status: z.string() }).parse(req.body);
    await updateContactStatus(id, status, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.patch('/contacts/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { assigneeId } = z.object({ assigneeId: z.string().uuid() }).parse(req.body);
    await assignContact(id, (req as any).admin.id, assigneeId);
    return reply.send({ ok: true });
  });

  app.post('/contacts/:id/notes', async (req, reply) => {
    const { id }   = req.params as { id: string };
    const { body, isPinned } = z.object({ body: z.string().min(1), isPinned: z.boolean().optional() }).parse(req.body);
    await addNote({ contactId: id, authorId: (req as any).admin.id, body, isPinned });
    return reply.status(201).send({ ok: true });
  });

  app.post('/contacts/:id/activities', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body   = req.body as { type: string; subject?: string; body?: string; metadata?: Record<string, unknown> };
    await addActivity({ contactId: id, adminId: (req as any).admin.id, ...body });
    return reply.status(201).send({ ok: true });
  });

  app.post('/refresh-scores', async (_req, reply) => {
    refreshAllScores().catch(console.error); // async, don't block
    return reply.send({ ok: true, message: 'Score refresh started' });
  });
}
