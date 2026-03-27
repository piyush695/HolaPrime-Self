import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function featureFlagsRoutes(app: FastifyInstance) {
  // Public: trader app reads flags
  app.get('/public', async (_req, reply) => {
    const rows = await query('SELECT key, enabled FROM feature_flags ORDER BY category, key');
    const flags: Record<string,boolean> = {};
    for (const r of rows as any[]) flags[r.key] = r.enabled;
    return reply.send(flags);
  });

  // Admin auth
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.endsWith('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM feature_flags ORDER BY category, label');
    return reply.send(rows);
  });

  app.patch('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { enabled } = req.body as { enabled: boolean };
    const admin = (req as any).admin;
    await query(
      'UPDATE feature_flags SET enabled=$1, updated_by=$2, updated_at=NOW() WHERE key=$3',
      [enabled, admin.id, key]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data)
      VALUES ($1,'feature_flag.toggle','feature_flag',$2)`,
      [admin.id, key, JSON.stringify({ enabled })]);
    return reply.send({ ok: true, key, enabled });
  });

  app.post('/', async (req, reply) => {
    const { key, label, description, category, enabled } = req.body as any;
    const admin = (req as any).admin;
    await query(
      'INSERT INTO feature_flags (key,label,description,category,enabled,updated_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (key) DO UPDATE SET label=$2,description=$3,updated_at=NOW()',
      [key, label, description, category ?? 'general', enabled ?? true, admin.id]
    );
    return reply.status(201).send({ ok: true });
  });
}
