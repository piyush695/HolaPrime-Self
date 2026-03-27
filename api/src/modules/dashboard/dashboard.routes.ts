import type { FastifyInstance } from 'fastify';
import { getDashboardMetrics } from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);
  app.get('/', async (_req, reply) => reply.send(await getDashboardMetrics()));
}
