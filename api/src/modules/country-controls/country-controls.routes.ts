import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function countryControlsRoutes(app: FastifyInstance) {
  app.get('/public', async (_req, reply) => {
    const rows = await query('SELECT country_code, registration, payouts, kyc_required, risk_tier FROM country_controls');
    return reply.send(rows);
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.endsWith('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT * FROM country_controls ORDER BY country_name');
    return reply.send(rows);
  });

  app.patch('/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const { registration, payouts, kyc_required, risk_tier, max_payout, notes } = req.body as any;
    const admin = (req as any).admin;
    await query(
      `UPDATE country_controls SET registration=$1,payouts=$2,kyc_required=$3,risk_tier=$4,max_payout=$5,notes=$6,updated_by=$7,updated_at=NOW() WHERE country_code=$8`,
      [registration, payouts, kyc_required, risk_tier, max_payout ?? null, notes ?? null, admin.id, code.toUpperCase()]
    );
    await query(`INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,'country_control.update','country',$2)`,
      [admin.id, code, JSON.stringify({ registration, payouts, risk_tier })]);
    return reply.send({ ok: true });
  });

  app.post('/', async (req, reply) => {
    const { country_code, country_name, registration, payouts, risk_tier } = req.body as any;
    const admin = (req as any).admin;
    await query(
      'INSERT INTO country_controls (country_code,country_name,registration,payouts,risk_tier,updated_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (country_code) DO UPDATE SET country_name=$2,registration=$3,payouts=$4,risk_tier=$5',
      [country_code.toUpperCase(), country_name, registration ?? true, payouts ?? true, risk_tier ?? 'standard', admin.id]
    );
    return reply.status(201).send({ ok: true });
  });
}
