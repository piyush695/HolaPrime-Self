import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/index.js';
import { config } from '../../config/index.js';
import {
  handleWebhook, sendTemplateMessage, sendTextMessage,
  listTemplates, getConversations, getConversationMessages, getWAStats,
} from './whatsapp.service.js';

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // ── Meta webhook (unauthenticated) ────────────────────────────────────────
  app.get('/webhook', async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === config.whatsapp.verifyToken) {
      return reply.status(200).send(q['hub.challenge']);
    }
    return reply.status(403).send('Forbidden');
  });

  app.post('/webhook', async (req, reply) => {
    handleWebhook(req.body as Record<string, unknown>).catch(console.error);
    return reply.status(200).send('EVENT_RECEIVED');
  });

  // ── Admin auth for everything below ──────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/webhook')) return;
    return app.authenticate(req, reply);
  });

  // ── Stats & conversations ─────────────────────────────────────────────────
  app.get('/stats',     async (_req, reply) => reply.send(await getWAStats()));

  app.get('/conversations', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await getConversations({
      page: parseInt(q.page ?? '1', 10), limit: parseInt(q.limit ?? '25', 10), status: q.status,
    }));
  });

  app.get('/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = await getConversationMessages(id);
    if (!conv) return reply.status(404).send({ error: 'Not found' });
    return reply.send(conv);
  });

  // ── Send messages ─────────────────────────────────────────────────────────
  app.post('/send/template', async (req, reply) => {
    const body = z.object({
      phone: z.string().min(8), templateId: z.string().uuid(),
      variables: z.record(z.string()), contactId: z.string().uuid().optional(),
    }).parse(req.body);
    const id = await sendTemplateMessage(body);
    return reply.status(201).send({ id });
  });

  app.post('/send/text', async (req, reply) => {
    const body = z.object({
      phone: z.string().min(8), body: z.string().min(1).max(4096),
      contactId: z.string().uuid().optional(), conversationId: z.string().uuid().optional(),
    }).parse(req.body);
    await sendTextMessage({ ...body, adminId: (req as any).admin.id });
    return reply.status(201).send({ ok: true });
  });

  // ── Template CRUD ─────────────────────────────────────────────────────────
  app.get('/templates', async (_req, reply) => {
    const rows = await query('SELECT * FROM whatsapp_templates ORDER BY category, name');
    return reply.send(rows);
  });

  app.get('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await queryOne('SELECT * FROM whatsapp_templates WHERE id=$1', [id]);
    if (!row) return reply.status(404).send({ error: 'Not found' });
    return reply.send(row);
  });

  app.post('/templates', async (req, reply) => {
    const {
      name, wa_template_name, language = 'en_US', category = 'MARKETING',
      header_type, header_content, body_text, footer_text, buttons = [], variables = [],
    } = req.body as any;
    const admin = (req as any).admin;
    if (!name || !wa_template_name || !body_text) {
      return reply.status(400).send({ error: 'name, wa_template_name, body_text required' });
    }
    const row = await queryOne(
      `INSERT INTO whatsapp_templates
         (name, wa_template_name, language, category, status, header_type, header_content,
          body_text, footer_text, buttons, variables, created_by)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [name, wa_template_name, language, category, header_type ?? null, header_content ?? null,
       body_text, footer_text ?? null, JSON.stringify(buttons), variables, admin.id]
    );
    return reply.status(201).send(row);
  });

  app.patch('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const {
      name, wa_template_name, language, category, status,
      header_type, header_content, body_text, footer_text, buttons, variables,
    } = req.body as any;
    const fields: string[] = ['updated_at=NOW()'];
    const vals: any[] = [];
    const set = (col: string, val: any) => { vals.push(val); fields.push(`${col}=$${vals.length}`); };
    if (name !== undefined)            set('name', name);
    if (wa_template_name !== undefined) set('wa_template_name', wa_template_name);
    if (language !== undefined)        set('language', language);
    if (category !== undefined)        set('category', category);
    if (status !== undefined)          set('status', status);
    if (header_type !== undefined)     set('header_type', header_type);
    if (header_content !== undefined)  set('header_content', header_content);
    if (body_text !== undefined)       set('body_text', body_text);
    if (footer_text !== undefined)     set('footer_text', footer_text);
    if (buttons !== undefined)         set('buttons', JSON.stringify(buttons));
    if (variables !== undefined)       set('variables', variables);
    vals.push(id);
    await query(`UPDATE whatsapp_templates SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
    return reply.send({ ok: true });
  });

  app.delete('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('DELETE FROM whatsapp_templates WHERE id=$1', [id]);
    return reply.send({ ok: true });
  });
}
