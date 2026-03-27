import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function ipBlocklistRoutes(app: FastifyInstance) {
  // Hook to check IP on every trader request (add to trader routes separately)
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM ip_blocklist ORDER BY created_at DESC');
    return reply.send(rows);
  });

  app.post('/', async (req, reply) => {
    const { ip_address, reason, expires_at } = req.body as any;
    const admin = (req as any).admin;
    await query(
      'INSERT INTO ip_blocklist (ip_address,reason,blocked_by,expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT (ip_address) DO UPDATE SET reason=$2, expires_at=$4',
      [ip_address, reason ?? null, admin.id, expires_at ?? null]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,'ip.block','ip_blocklist',$2)`,
      [admin.id, ip_address, JSON.stringify({ reason })]);
    return reply.status(201).send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const admin = (req as any).admin;
    const row = await queryOne<any>('SELECT ip_address FROM ip_blocklist WHERE id=$1', [id]);
    await query('DELETE FROM ip_blocklist WHERE id=$1', [id]);
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,'ip.unblock','ip_blocklist',$2)`,
      [admin.id, row?.ip_address ?? id, JSON.stringify({})]);
    return reply.send({ ok: true });
  });
}
