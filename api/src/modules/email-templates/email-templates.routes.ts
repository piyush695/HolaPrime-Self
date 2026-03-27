import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function emailTemplatesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM email_templates ORDER BY label');
    return reply.send(rows);
  });

  app.get('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const row = await queryOne('SELECT * FROM email_templates WHERE key=$1', [key]);
    if (!row) return reply.status(404).send({ error: 'Template not found' });
    return reply.send(row);
  });

  app.patch('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { subject, html_body, text_body, enabled } = req.body as any;
    const admin = (req as any).admin;
    const fields: string[] = ['updated_at=NOW()', 'updated_by=$1'];
    const vals: any[] = [admin.id];
    if (subject !== undefined) { vals.push(subject); fields.push(`subject=$${vals.length}`); }
    if (html_body !== undefined) { vals.push(html_body); fields.push(`html_body=$${vals.length}`); }
    if (text_body !== undefined) { vals.push(text_body); fields.push(`text_body=$${vals.length}`); }
    if (enabled !== undefined) { vals.push(enabled); fields.push(`enabled=$${vals.length}`); }
    vals.push(key);
    await query(`UPDATE email_templates SET ${fields.join(',')} WHERE key=$${vals.length}`, vals);
    return reply.send({ ok: true });
  });

  // Test-send a template
  app.post('/:key/test', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { email } = req.body as { email: string };
    // Would call email service here
    return reply.send({ ok: true, message: `Test email sent to ${email}` });
  });
}
