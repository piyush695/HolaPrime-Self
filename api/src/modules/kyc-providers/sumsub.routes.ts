import type { FastifyInstance } from 'fastify';
import { getSumsubService } from './sumsub.service.js';
import { query, queryOne } from '../../db/index.js';

export async function sumsubRoutes(app: FastifyInstance): Promise<void> {

  // ── Trader: get SDK access token (called by trader portal to launch WebSDK) ─
  app.get('/sdk-token', async (req, reply) => {
    let traderId: string;
    try {
      const p = await req.jwtVerify<{ sub: string; type: string }>();
      if (p.type !== 'trader') return reply.status(401).send({ error: 'Unauthorised' });
      traderId = p.sub;
    } catch {
      return reply.status(401).send({ error: 'Unauthorised' });
    }

    const user = await queryOne<{
      id: string; email: string; first_name: string; last_name: string;
      phone: string; country_code: string;
    }>('SELECT * FROM users WHERE id = $1', [traderId]);

    if (!user) return reply.status(404).send({ error: 'User not found' });

    const ss = getSumsubService();

    // Create applicant if first time
    await ss.createApplicant({
      userId:      user.id,
      email:       user.email,
      phone:       user.phone,
      firstName:   user.first_name,
      lastName:    user.last_name,
      countryCode: user.country_code,
    });

    // Return access token for the WebSDK
    const token = await ss.getAccessToken(user.id);
    return reply.send({ token });
  });

  // ── Webhook from SumSub (no auth — verified by signature) ──────────────────
  app.post('/webhook', async (req, reply) => {
    const sig = req.headers['x-payload-digest'] as string;
    if (!sig) return reply.status(400).send('Missing signature');

    try {
      const rawBody = JSON.stringify(req.body);
      const ss      = getSumsubService();
      await ss.handleWebhook(rawBody, sig);
      return reply.status(200).send('OK');
    } catch (err) {
      app.log.error({ err }, 'SumSub webhook error');
      return reply.status(400).send('Webhook error');
    }
  });

  // ── Admin routes ────────────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    const pub = ['/sdk-token', '/webhook'];
    if (pub.some(p => req.url.endsWith(p))) return;
    return app.authenticate(req, reply);
  });

  // Get applicant status for a user
  app.get('/applicants/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const row = await queryOne(
      'SELECT * FROM sumsub_applicants WHERE user_id = $1', [userId],
    );
    if (!row) return reply.status(404).send({ error: 'No SumSub record for this user' });

    // Optionally fetch live status
    const ss     = getSumsubService();
    const status = await ss.getApplicantStatus((row as any).applicant_id).catch(() => null);

    return reply.send({ ...row, liveStatus: status });
  });

  // Reset an applicant (allow re-submission after rejection)
  app.post('/applicants/:userId/reset', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const row = await queryOne<{ applicant_id: string }>(
      'SELECT applicant_id FROM sumsub_applicants WHERE user_id = $1', [userId],
    );
    if (!row) return reply.status(404).send({ error: 'Not found' });

    const ss = getSumsubService();
    await ss.resetApplicant(row.applicant_id);

    await query(
      "UPDATE users SET kyc_status = 'pending', updated_at = NOW() WHERE id = $1",
      [userId],
    );

    return reply.send({ ok: true });
  });

  // List all SumSub applicants (for admin KYC queue)
  app.get('/applicants', async (_req, reply) => {
    const rows = await query(`
      SELECT sa.*, u.email, u.first_name, u.last_name, u.country_code, u.kyc_status
      FROM sumsub_applicants sa
      JOIN users u ON u.id = sa.user_id
      ORDER BY sa.updated_at DESC
      LIMIT 200
    `);
    return reply.send(rows);
  });

  // Override — manually approve/reject regardless of SumSub result
  app.post('/applicants/:userId/override', async (req, reply) => {
    const { userId }   = req.params as { userId: string };
    const { decision, reason } = req.body as { decision: 'approved'|'rejected'; reason?: string };
    const admin        = (req as any).admin;

    await query("UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2", [decision, userId]);
    await query(`
      INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, new_data)
      VALUES ($1, $2, 'user', $3, $4)
    `, [admin.id, `kyc.manual_${decision}`, userId, JSON.stringify({ reason })]);

    return reply.send({ ok: true });
  });
}
