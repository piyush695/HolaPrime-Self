import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getTradingStats, listSyncAccounts,
  getAccountPositions, triggerManualSync,
} from './trading-sync.service.js';
import {
  listPlatformConfigs, getPlatformConfig,
  savePlatformCredentials, testPlatformConnection,
  getAllPlatformHealth,
} from './platform-credentials.service.js';

export async function tradingSyncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  // ── Platform credential management ─────────────────────────────────────────
  app.get('/platforms', async (_req, reply) =>
    reply.send(await listPlatformConfigs()),
  );

  app.get('/platforms/health', async (_req, reply) =>
    reply.send(await getAllPlatformHealth()),
  );

  app.get('/platforms/:platform', async (req, reply) => {
    const { platform } = req.params as { platform: string };
    const config = await getPlatformConfig(platform);
    if (!config) return reply.status(404).send({ error: 'Platform not found' });
    // Mask sensitive keys before returning
    const masked = { ...config };
    const creds  = (masked.credentials as Record<string, string>) ?? {};
    const maskedCreds: Record<string, string> = {};
    for (const [k, v] of Object.entries(creds)) {
      const isSecret = /key|secret|password|token/i.test(k);
      maskedCreds[k] = isSecret && v ? '••••••••' + v.slice(-4) : (v as string);
    }
    masked.credentials = maskedCreds;
    return reply.send(masked);
  });

  app.put('/platforms/:platform', async (req, reply) => {
    const { platform } = req.params as { platform: string };
    const body = z.object({
      credentials: z.record(z.string()),
      isActive:    z.boolean().optional(),
    }).parse(req.body);

    // Don't overwrite masked values — fetch existing and merge
    const existing = await getPlatformConfig(platform);
    const existingCreds = (existing as any)?.credentials ?? {};
    const merged: Record<string, string> = { ...existingCreds };
    for (const [k, v] of Object.entries(body.credentials)) {
      if (!v.startsWith('••••')) merged[k] = v; // only update unmasked values
    }

    await savePlatformCredentials(
      platform, merged, body.isActive ?? (existing as any)?.is_active ?? false,
      (req as any).admin.id,
    );
    return reply.send({ ok: true });
  });

  app.post('/platforms/:platform/test', async (req, reply) => {
    const { platform } = req.params as { platform: string };
    const result = await testPlatformConnection(platform);
    return reply.send(result);
  });

  // ── Trading sync stats & accounts ──────────────────────────────────────────
  app.get('/stats', async (_req, reply) =>
    reply.send(await getTradingStats()),
  );

  app.get('/accounts', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listSyncAccounts({
      page:     parseInt(q.page  ?? '1',  10),
      limit:    parseInt(q.limit ?? '25', 10),
      platform: q.platform,
      status:   q.status,
      hasError: q.hasError === 'true',
      search:   q.search,
    }));
  });

  app.get('/accounts/:id/positions', async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send(await getAccountPositions(id));
  });

  app.post('/accounts/:id/sync', async (req, reply) => {
    const { id } = req.params as { id: string };
    await triggerManualSync(id);
    return reply.send({ ok: true });
  });
}
