import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../../config/index.js';
import {
  handleWebhook, sendTemplateMessage, sendTextMessage,
  listTemplates, getConversations, getConversationMessages, getWAStats,
} from './whatsapp.service.js';

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // ── Meta webhook verification (GET) ──────────────────────────────────────
  app.get('/webhook', async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === config.whatsapp.verifyToken) {
      return reply.status(200).send(q['hub.challenge']);
    }
    return reply.status(403).send('Forbidden');
  });

  // ── Meta webhook delivery (POST — no auth) ────────────────────────────────
  app.post('/webhook', async (req, reply) => {
    handleWebhook(req.body as Record<string, unknown>).catch(console.error);
    return reply.status(200).send('EVENT_RECEIVED');
  });

  // ── Admin routes (auth required) ──────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/webhook')) return;
    return app.authenticate(req, reply);
  });

  app.get('/stats',     async (_req, reply) => reply.send(await getWAStats()));
  app.get('/templates', async (_req, reply) => reply.send(await listTemplates()));

  app.get('/conversations', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await getConversations({
      page:   parseInt(q.page  ?? '1',  10),
      limit:  parseInt(q.limit ?? '25', 10),
      status: q.status,
    }));
  });

  app.get('/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv   = await getConversationMessages(id);
    if (!conv) return reply.status(404).send({ error: 'Not found' });
    return reply.send(conv);
  });

  app.post('/send/template', async (req, reply) => {
    const body = z.object({
      phone:      z.string().min(8),
      templateId: z.string().uuid(),
      variables:  z.record(z.string()),
      contactId:  z.string().uuid().optional(),
    }).parse(req.body);
    const id = await sendTemplateMessage(body);
    return reply.status(201).send({ id });
  });

  app.post('/send/text', async (req, reply) => {
    const body = z.object({
      phone:          z.string().min(8),
      body:           z.string().min(1).max(4096),
      contactId:      z.string().uuid().optional(),
      conversationId: z.string().uuid().optional(),
    }).parse(req.body);
    await sendTextMessage({ ...body, adminId: (req as any).admin.id });
    return reply.status(201).send({ ok: true });
  });
}
