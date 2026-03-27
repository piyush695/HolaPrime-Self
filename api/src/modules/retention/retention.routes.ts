import type { FastifyInstance } from 'fastify';
import {
  getCohortData, getChurnRiskUsers, getWinBackCandidates,
  getRetentionStats, buildCohortTable,
} from './retention.service.js';

export async function retentionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats',       async (_req, reply) => reply.send(await getRetentionStats()));
  app.get('/cohorts',     async (_req, reply) => reply.send(await getCohortData()));
  app.get('/churn-risk',  async (_req, reply) => reply.send(await getChurnRiskUsers()));
  app.get('/win-back',    async (_req, reply) => reply.send(await getWinBackCandidates()));
  app.post('/rebuild-cohorts', async (_req, reply) => {
    buildCohortTable().catch(console.error);
    return reply.send({ ok: true, message: 'Cohort rebuild started' });
  });
}
