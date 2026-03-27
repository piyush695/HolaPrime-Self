import type { FastifyInstance } from 'fastify';
import {
  listProducts, getProduct, createProduct,
  listAccounts, getAccountDetail, provisionAccount,
  syncAccountBalance, getAccountStats,
} from './challenges.service.js';

export async function challengeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  // ── Products ────────────────────────────────────────────────────────────────

  app.get('/products', async (_req, reply) =>
    reply.send(await listProducts()),
  );

  app.get('/products/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = await getProduct(id);
    if (!p) return reply.status(404).send({ error: 'Not found' });
    return reply.send(p);
  });

  app.post('/products', async (req, reply) => {
    const admin   = (req as any).admin;
    const product = await createProduct(req.body as Record<string, unknown>, admin.id);
    return reply.status(201).send(product);
  });

  // ── Accounts ────────────────────────────────────────────────────────────────

  app.get('/accounts/stats', async (_req, reply) =>
    reply.send(await getAccountStats()),
  );

  app.get('/accounts', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const result = await listAccounts({
      page:     parseInt(q.page  ?? '1',  10),
      limit:    parseInt(q.limit ?? '25', 10),
      userId:   q.userId,
      status:   q.status,
      platform: q.platform,
      phase:    q.phase,
    });
    return reply.send(result);
  });

  app.get('/accounts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await getAccountDetail(id);
    if (!account) return reply.status(404).send({ error: 'Not found' });
    return reply.send(account);
  });

  app.post('/accounts/:id/sync', async (req, reply) => {
    const { id } = req.params as { id: string };
    await syncAccountBalance(id);
    return reply.send({ ok: true });
  });

  // Manual provision (admin creates account for a user)
  app.post('/accounts/provision', async (req, reply) => {
    const admin  = (req as any).admin;
    const body   = req.body as {
      userId: string; productId: string; paymentId: string;
    };
    const accountId = await provisionAccount({ ...body, adminId: admin.id });
    return reply.status(201).send({ accountId });
  });
}
