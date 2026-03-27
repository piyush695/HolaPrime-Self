import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listUsers, getUserById, updateUserStatus, getUserStats,
} from './users.service.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // All user routes require auth
  app.addHook('onRequest', app.authenticate);

  // GET /users
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const result = await listUsers({
      page:      parseInt(q.page  ?? '1',  10),
      limit:     parseInt(q.limit ?? '25', 10),
      search:    q.search,
      status:    q.status,
      kycStatus: q.kycStatus,
      country:   q.country,
      from:      q.from,
      to:        q.to,
    });
    return reply.send(result);
  });

  // GET /users/stats
  app.get('/stats', async (_req, reply) => {
    const stats = await getUserStats();
    return reply.send(stats);
  });

  // GET /users/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await getUserById(id);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send(user);
  });

  // PATCH /users/:id/status
  app.patch('/:id/status', async (req, reply) => {
    const { id }     = req.params as { id: string };
    const { status } = z.object({ status: z.enum(['active','suspended','banned']) })
      .parse(req.body);
    const admin = (req as any).admin;
    await updateUserStatus(id, status, admin.id);
    return reply.send({ ok: true });
  });
}
