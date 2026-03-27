import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getKycQueue, getKycSubmission, approveKyc,
  rejectKyc, generateDocumentSignedUrl, getKycStats,
} from './kyc.service.js';

export async function kycRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (_req, reply) => reply.send(await getKycStats()));

  app.get('/queue', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const result = await getKycQueue(
      q.status ?? 'pending',
      parseInt(q.page  ?? '1',  10),
      parseInt(q.limit ?? '25', 10),
    );
    return reply.send(result);
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sub = await getKycSubmission(id);
    if (!sub) return reply.status(404).send({ error: 'Not found' });
    return reply.send(sub);
  });

  app.post('/:id/approve', async (req, reply) => {
    const { id }  = req.params as { id: string };
    const admin   = (req as any).admin;
    await approveKyc(id, admin.id);
    return reply.send({ ok: true });
  });

  app.post('/:id/reject', async (req, reply) => {
    const { id }     = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().min(10) }).parse(req.body);
    const admin      = (req as any).admin;
    await rejectKyc(id, admin.id, reason);
    return reply.send({ ok: true });
  });

  app.get('/:id/documents/:docId/url', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const url = await generateDocumentSignedUrl(id, docId);
    return reply.send({ url });
  });
}
