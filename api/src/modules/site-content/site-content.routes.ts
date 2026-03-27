import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function siteContentRoutes(app: FastifyInstance) {
  // Public endpoint for trader app
  app.get('/public/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const row = await queryOne<any>('SELECT value, content_type FROM site_content WHERE key=$1', [key]);
    if (!row) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ value: row.value });
  });

  app.get('/public', async (_req, reply) => {
    const rows = await query('SELECT key, value, content_type FROM site_content');
    const result: Record<string,any> = {};
    for (const r of rows as any[]) result[r.key] = r.value;
    return reply.send(result);
  });

  // Admin auth
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM site_content ORDER BY label');
    return reply.send(rows);
  });

  app.patch('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { value } = req.body as { value: any };
    const admin = (req as any).admin;
    await query(
      'UPDATE site_content SET value=$1, updated_by=$2, updated_at=NOW() WHERE key=$3',
      [JSON.stringify(value), admin.id, key]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data)
      VALUES ($1,'site_content.update','site_content',$2)`,
      [admin.id, key, JSON.stringify({ value })]);
    return reply.send({ ok: true });
  });
}
