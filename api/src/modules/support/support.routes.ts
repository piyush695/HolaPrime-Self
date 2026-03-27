import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

function genTicketNo() { return 'HP-' + Date.now().toString(36).toUpperCase().slice(-6); }

export async function supportRoutes(app: FastifyInstance) {
  // Trader routes
  app.post('/tickets', async (req, reply) => {
    const p = await req.jwtVerify<{ sub: string; type: string }>().catch(() => null);
    const { subject, message, category, priority } = req.body as any;
    const userId = p?.type === 'trader' ? p.sub : null;
    const row = await queryOne(
      'INSERT INTO support_tickets (ticket_no,user_id,subject,message,category,priority) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, ticket_no',
      [genTicketNo(), userId, subject, message, category ?? 'general', priority ?? 'normal']
    );
    return reply.status(201).send(row);
  });

  app.get('/my-tickets', async (req, reply) => {
    const p = await req.jwtVerify<{ sub: string; type: string }>().catch(() => null);
    if (!p || p.type !== 'trader') return reply.status(401).send({ error: 'Unauthorised' });
    const rows = await query('SELECT id,ticket_no,subject,category,priority,status,created_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC', [p.sub]);
    return reply.send(rows);
  });

  // Admin auth
  app.addHook('onRequest', async (req, reply) => {
    const publicPaths = ['/tickets', '/my-tickets'];
    if (publicPaths.some(p => req.url.endsWith(p))) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (req, reply) => {
    const { status, priority, assigned } = req.query as any;
    let where = 'WHERE 1=1';
    const vals: any[] = [];
    if (status) { vals.push(status); where += ` AND st.status=$${vals.length}`; }
    if (priority) { vals.push(priority); where += ` AND st.priority=$${vals.length}`; }
    if (assigned) { vals.push(assigned); where += ` AND st.assigned_to=$${vals.length}`; }
    const rows = await query(
      `SELECT st.*, u.email, u.first_name, u.last_name, a.first_name as assignee_name
       FROM support_tickets st LEFT JOIN users u ON u.id=st.user_id LEFT JOIN admin_users a ON a.id=st.assigned_to
       ${where} ORDER BY CASE st.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, st.created_at ASC`,
      vals
    );
    return reply.send(rows);
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ticket = await queryOne(`SELECT st.*, u.email, u.first_name, u.last_name FROM support_tickets st LEFT JOIN users u ON u.id=st.user_id WHERE st.id=$1`, [id]);
    if (!ticket) return reply.status(404).send({ error: 'Not found' });
    const replies = await query('SELECT * FROM ticket_replies WHERE ticket_id=$1 ORDER BY created_at ASC', [id]);
    return reply.send({ ...(ticket as any), replies });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, assigned_to, priority } = req.body as any;
    const admin = (req as any).admin;
    await query(
      `UPDATE support_tickets SET status=COALESCE($1,status), assigned_to=COALESCE($2,assigned_to), priority=COALESCE($3,priority), resolved_at=CASE WHEN $1='resolved' THEN NOW() ELSE resolved_at END, updated_at=NOW() WHERE id=$4`,
      [status ?? null, assigned_to ?? null, priority ?? null, id]
    );
    return reply.send({ ok: true });
  });

  app.post('/:id/reply', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { message } = req.body as { message: string };
    const admin = (req as any).admin;
    await queryOne('INSERT INTO ticket_replies (ticket_id,author_id,author_type,message) VALUES ($1,$2,$3,$4) RETURNING id', [id, admin.id, 'admin', message]);
    await query("UPDATE support_tickets SET status='in_progress', updated_at=NOW() WHERE id=$1 AND status='open'", [id]);
    return reply.status(201).send({ ok: true });
  });
}
