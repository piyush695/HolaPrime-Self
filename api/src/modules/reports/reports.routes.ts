import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  generateReport, listReportDefinitions,
  createReportDefinition, listReportRuns,
} from './reports.service.js';

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  // Quick ad-hoc report generation
  app.get('/generate', async (req, reply) => {
    const q    = req.query as Record<string, string>;
    const type = q.type ?? 'revenue';
    const fmt  = q.format ?? 'json';

    const result = await generateReport({
      type,
      from:   q.from,
      to:     q.to,
      format: fmt,
      triggeredBy: (req as any).admin.id,
    });

    if (fmt === 'csv' && result.csv) {
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${type}-report.csv"`)
        .send(result.csv);
    }
    return reply.send(result.data);
  });

  // Report definitions (scheduled)
  app.get('/definitions', async (_req, reply) =>
    reply.send(await listReportDefinitions()),
  );

  app.post('/definitions', async (req, reply) => {
    const body = z.object({
      name:        z.string().min(1),
      type:        z.enum(['revenue','users','risk','affiliates','custom']),
      format:      z.enum(['pdf','csv','xlsx','json']).default('xlsx'),
      frequency:   z.enum(['daily','weekly','monthly','quarterly','one_time']).optional(),
      recipients:  z.array(z.string().email()).optional(),
      queryConfig: z.record(z.unknown()).optional(),
    }).parse(req.body);
    const id = await createReportDefinition(body, (req as any).admin.id);
    return reply.status(201).send({ id });
  });

  // Report run history
  app.get('/runs', async (req, reply) => {
    const q = req.query as Record<string, string>;
    return reply.send(await listReportRuns(q.definitionId));
  });
}
