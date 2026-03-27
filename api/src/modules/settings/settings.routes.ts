import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getAllSettings, upsertSetting, bulkUpsertSettings,
  listAdminUsers, createAdminUser, updateAdminUser, resetAdminPassword,
  getPlatformHealth, getAuditLog,
} from './settings.service.js';

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
}
