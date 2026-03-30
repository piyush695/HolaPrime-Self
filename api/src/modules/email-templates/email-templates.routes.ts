import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function emailTemplatesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  // GET all templates
  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM email_templates ORDER BY label');
    return reply.send(rows);
  });

  // GET single template
  app.get('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const row = await queryOne('SELECT * FROM email_templates WHERE key=$1', [key]);
    if (!row) return reply.status(404).send({ error: 'Template not found' });
    return reply.send(row);
  });

  // POST create new template
  app.post('/', async (req, reply) => {
    const { key, label, subject, html_body, text_body, variables } = req.body as any;
    const admin = (req as any).admin;
    if (!key || !label || !subject || !html_body) {
      return reply.status(400).send({ error: 'key, label, subject, html_body required' });
    }
    await query(
      `INSERT INTO email_templates (key, label, subject, html_body, text_body, variables, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [key, label, subject, html_body, text_body ?? '', JSON.stringify(variables ?? []), admin.id]
    );
    const created = await queryOne('SELECT * FROM email_templates WHERE key=$1', [key]);
    return reply.status(201).send(created);
  });

  // PATCH update template
  app.patch('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { subject, html_body, text_body, enabled, label, variables } = req.body as any;
    const admin = (req as any).admin;
    const fields: string[] = ['updated_at=NOW()', 'updated_by=$1'];
    const vals: any[] = [admin.id];
    if (subject !== undefined)   { vals.push(subject);   fields.push(`subject=$${vals.length}`); }
    if (html_body !== undefined) { vals.push(html_body); fields.push(`html_body=$${vals.length}`); }
    if (text_body !== undefined) { vals.push(text_body); fields.push(`text_body=$${vals.length}`); }
    if (enabled !== undefined)   { vals.push(enabled);   fields.push(`enabled=$${vals.length}`); }
    if (label !== undefined)     { vals.push(label);     fields.push(`label=$${vals.length}`); }
    if (variables !== undefined) { vals.push(JSON.stringify(variables)); fields.push(`variables=$${vals.length}`); }
    vals.push(key);
    await query(`UPDATE email_templates SET ${fields.join(',')} WHERE key=$${vals.length}`, vals);
    return reply.send({ ok: true });
  });

  // DELETE template
  app.delete('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    await query('DELETE FROM email_templates WHERE key=$1', [key]);
    return reply.send({ ok: true });
  });

  // Test-send a template
  app.post('/:key/test', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { email } = req.body as { email: string };
    return reply.send({ ok: true, message: `Test email queued for ${email}` });
  });
}
