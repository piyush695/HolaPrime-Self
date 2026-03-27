import type { FastifyInstance } from 'fastify';
import { listAuditLogs, getAuditStats, getAuditModules, getAuditActions } from './audit.service.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listAuditLogs({
      page:       parseInt(q.page  ?? '1',  10),
      limit:      parseInt(q.limit ?? '50', 10),
      module:     q.module,
      action:     q.action,
      adminId:    q.adminId,
      entityType: q.entityType,
      entityId:   q.entityId,
      from:       q.from,
      to:         q.to,
      search:     q.search,
    }));
  });

  app.get('/stats',   async (_req, reply) => reply.send(await getAuditStats()));
  app.get('/modules', async (_req, reply) => reply.send(await getAuditModules()));
  app.get('/actions', async (_req, reply) => reply.send(await getAuditActions()));
}
