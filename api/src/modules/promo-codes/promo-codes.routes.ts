import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function promoCodesRoutes(app: FastifyInstance) {
  // Trader: validate a promo code
  app.post('/validate', async (req, reply) => {
    const { code, amount, slug } = req.body as { code: string; amount: number; slug?: string };
    const row = await queryOne<any>(
      `SELECT * FROM promo_codes WHERE UPPER(code)=UPPER($1) AND enabled=true
       AND (valid_until IS NULL OR valid_until > NOW())
       AND (max_uses IS NULL OR used_count < max_uses)`,
      [code]
    );
    if (!row) return reply.status(404).send({ error: 'Invalid or expired promo code' });
    if (amount < (row.min_purchase ?? 0)) return reply.status(400).send({ error: `Minimum purchase of $\${row.min_purchase} required` });
    const applicable = row.applicable_to ?? ['all'];
    if (!applicable.includes('all') && slug && !applicable.includes(slug)) return reply.status(400).send({ error: 'Code not applicable to this challenge' });
    const discount = row.discount_type === 'percentage'
      ? (amount * row.discount_value / 100)
      : Math.min(row.discount_value, amount);
    return reply.send({ valid: true, discount: parseFloat(discount.toFixed(2)), discount_type: row.discount_type, discount_value: row.discount_value, final_amount: parseFloat((amount - discount).toFixed(2)) });
  });

  // Admin auth
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.endsWith('/validate')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT pc.*, COUNT(pcu.id) as redemptions FROM promo_codes pc LEFT JOIN promo_code_uses pcu ON pcu.code_id=pc.id GROUP BY pc.id ORDER BY pc.created_at DESC');
    return reply.send(rows);
  });

  app.post('/', async (req, reply) => {
    const { code, description, discount_type, discount_value, min_purchase, max_uses, applicable_to, valid_from, valid_until, enabled } = req.body as any;
    const admin = (req as any).admin;
    const row = await queryOne(
      `INSERT INTO promo_codes (code,description,discount_type,discount_value,min_purchase,max_uses,applicable_to,valid_from,valid_until,enabled,created_by)
       VALUES (UPPER($1),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [code, description, discount_type ?? 'percentage', discount_value, min_purchase ?? 0, max_uses ?? null, JSON.stringify(applicable_to ?? ['all']), valid_from ?? new Date().toISOString(), valid_until ?? null, enabled ?? true, admin.id]
    );
    return reply.status(201).send(row);
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { enabled, max_uses, valid_until, discount_value } = req.body as any;
    const fields: string[] = []; const vals: any[] = [];
    if (enabled !== undefined) { fields.push(`enabled=$\${fields.length+1}`); vals.push(enabled); }
    if (max_uses !== undefined) { fields.push(`max_uses=$\${fields.length+1}`); vals.push(max_uses); }
    if (valid_until !== undefined) { fields.push(`valid_until=$\${fields.length+1}`); vals.push(valid_until); }
    if (discount_value !== undefined) { fields.push(`discount_value=$\${fields.length+1}`); vals.push(discount_value); }
    if (fields.length === 0) return reply.status(400).send({ error: 'Nothing to update' });
    vals.push(id);
    await query(`UPDATE promo_codes SET \${fields.join(',')} WHERE id=$\${vals.length}`, vals);
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('UPDATE promo_codes SET enabled=false WHERE id=$1', [id]);
    return reply.send({ ok: true });
  });

  app.get('/:id/uses', async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await query('SELECT pcu.*, u.email, u.first_name FROM promo_code_uses pcu JOIN users u ON u.id=pcu.user_id WHERE pcu.code_id=$1 ORDER BY pcu.used_at DESC', [id]);
    return reply.send(rows);
  });
}
