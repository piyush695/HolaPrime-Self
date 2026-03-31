import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getAllSettings, upsertSetting, bulkUpsertSettings,
  listAdminUsers, createAdminUser, updateAdminUser, resetAdminPassword,
  getPlatformHealth, getAuditLog,
} from './settings.service.js';
import { testSendGrid, listSendGridTemplates } from './sendgrid.service.js';
import { clearProviderCache } from './email.dispatcher.js';
import { testMailmodo } from './mailmodo.service.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  // ── Settings ────────────────────────────────────────────────────────────────
  app.get('/', async (_req, reply) =>
    reply.send(await getAllSettings()),
  );

  app.put('/', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    await bulkUpsertSettings(body, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.put('/:key', async (req, reply) => {
    const { key }   = req.params as { key: string };
    const { value } = req.body as { value: unknown };
    await upsertSetting(key, value, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  // ── Admin users ─────────────────────────────────────────────────────────────
  app.get('/admins', async (_req, reply) =>
    reply.send(await listAdminUsers()),
  );

  app.post('/admins', async (req, reply) => {
    const body = z.object({
      email:     z.string().email(),
      firstName: z.string().min(1),
      lastName:  z.string().min(1),
      role:      z.enum(['admin','compliance','support','finance','risk']),
      password:  z.string().min(8),
    }).parse(req.body);
    const id = await createAdminUser(body, (req as any).admin.id);
    return reply.status(201).send({ id });
  });

  app.patch('/admins/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body   = z.object({
      role:      z.string().optional(),
      isActive:  z.boolean().optional(),
      firstName: z.string().optional(),
      lastName:  z.string().optional(),
    }).parse(req.body);
    await updateAdminUser(id, body, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.post('/admins/:id/reset-password', async (req, reply) => {
    const { id }        = req.params as { id: string };
    const { password }  = z.object({ password: z.string().min(8) }).parse(req.body);
    await resetAdminPassword(id, password, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  // ── Platform health ─────────────────────────────────────────────────────────
  app.get('/platform-health', async (_req, reply) =>
    reply.send(await getPlatformHealth()),
  );

  // ── Audit log ────────────────────────────────────────────────────────────────
  app.get('/audit-log', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await getAuditLog({
      page:    parseInt(q.page ?? '1', 10),
      limit:   parseInt(q.limit ?? '50', 10),
      adminId: q.adminId,
    }));
  });

  // ── Email provider test endpoints ──────────────────────────────────────────
  app.post('/email/test-sendgrid', async (req, reply) => {
    const { apiKey, fromEmail, fromName, testRecipient } = req.body as any;
    if (!apiKey || !testRecipient) return reply.status(400).send({ error: 'apiKey and testRecipient required' });
    const result = await testSendGrid(apiKey, fromEmail ?? 'noreply@holaprime.com', fromName ?? 'Hola Prime', testRecipient);
    clearProviderCache();
    return reply.send(result);
  });

  app.post('/email/test-mailmodo', async (req, reply) => {
    const { apiKey } = req.body as any;
    if (!apiKey) return reply.status(400).send({ error: 'apiKey required' });
    const result = await testMailmodo(apiKey);
    clearProviderCache();
    return reply.send(result);
  });

  app.get('/email/sendgrid-templates', async (req, reply) => {
    const { apiKey } = req.query as any;
    if (!apiKey) return reply.status(400).send({ error: 'apiKey required' });
    const templates = await listSendGridTemplates(apiKey);
    return reply.send(templates);
  });

  app.post('/email/reload-config', async (_req, reply) => {
    clearProviderCache();
    return reply.send({ ok: true, message: 'Email provider config reloaded' });
  });

  app.post('/admins/invite', async (req, reply) => {
    const { email, firstName, lastName, role, tempPassword } = req.body as any;
    const admin = (req as any).admin;
    if (!email || !firstName || !role) return reply.status(400).send({ error: 'email, firstName, role required' });
    const { sendAdminInviteEmail } = await import('./email.dispatcher.js');
    const loginUrl = process.env.ADMIN_URL ?? 'https://holaprime-admin-panel-688552756595.asia-south1.run.app/login';
    const pass = tempPassword ?? Math.random().toString(36).slice(2, 10).toUpperCase();
    await sendAdminInviteEmail(email, firstName, `${admin.first_name} ${admin.last_name}`, role, loginUrl, pass);
    return reply.status(201).send({ ok: true, message: `Invite sent to ${email}` });
  });
}
