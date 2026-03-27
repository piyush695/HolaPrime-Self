import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function payoutRulesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM payout_rules ORDER BY rule_key');
    return reply.send(rows);
  });

  app.patch('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { value } = req.body as { value: any };
    const admin = (req as any).admin;
    await query(
      'UPDATE payout_rules SET value=$1, updated_by=$2, updated_at=NOW() WHERE rule_key=$3',
      [JSON.stringify({ value }), admin.id, key]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,'payout_rule.update','payout_rule',$2)`,
      [admin.id, key, JSON.stringify({ value })]);
    return reply.send({ ok: true });
  });

  // Payout queue management
  app.get('/queue', async (_req, reply) => {
    const rows = await query(`
      SELECT p.*, u.email, u.first_name, u.last_name, u.kyc_status
      FROM payout_requests p JOIN users u ON u.id=p.user_id
      WHERE p.status='pending' ORDER BY p.created_at ASC
    `);
    return reply.send(rows);
  });

  app.post('/queue/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { notes } = req.body as { notes?: string };
    const admin = (req as any).admin;
    await query(
      "UPDATE payout_requests SET status='processing', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2 WHERE id=$3",
      [admin.id, notes ?? null, id]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,'payout.approve','payout',$2,$3)`,
      [admin.id, id, JSON.stringify({ notes })]);
    return reply.send({ ok: true });
  });

  app.post('/queue/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };
    const admin = (req as any).admin;
    await query(
      "UPDATE payout_requests SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2 WHERE id=$3",
      [admin.id, reason, id]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,'payout.reject','payout',$2,$3)`,
      [admin.id, id, JSON.stringify({ reason })]);
    return reply.send({ ok: true });
  });

  app.post('/queue/batch-approve', async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    const admin = (req as any).admin;
    for (const id of ids) {
      await query("UPDATE payout_requests SET status='processing', reviewed_by=$1, reviewed_at=NOW(), auto_approved=false WHERE id=$2", [admin.id, id]);
    }
    return reply.send({ ok: true, processed: ids.length });
  });
}
