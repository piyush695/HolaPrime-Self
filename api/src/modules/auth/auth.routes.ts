import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginAdmin, refreshAccessToken, revokeSession } from './auth.service.js';
import { queryOne } from '../../db/index.js';
import bcrypt from 'bcryptjs';

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── DIAGNOSTIC: tests every step individually ──────────────────────────────
  app.get('/diagnose', async (req, reply) => {
    const results: Record<string, any> = {};

    // Step 1: DB connection
    try {
      await queryOne('SELECT 1 as ok');
      results.db = 'ok';
    } catch (e: any) { results.db = `FAIL: ${e.message}`; }

    // Step 2: Admin user exists
    try {
      const admin = await queryOne<any>(
        "SELECT id, email, is_active, role, LENGTH(password_hash) as hash_len FROM admin_users WHERE email='admin@holaprime.com'"
      );
      results.admin = admin
        ? { found: true, is_active: admin.is_active, role: admin.role, hash_len: admin.hash_len }
        : 'NOT FOUND — run: docker compose exec api npm run seed';
    } catch (e: any) { results.admin = `FAIL: ${e.message}`; }

    // Step 3: bcrypt compare
    try {
      const admin = await queryOne<any>(
        "SELECT password_hash FROM admin_users WHERE email='admin@holaprime.com'"
      );
      if (admin) {
        const match = await bcrypt.compare('Admin@HolaPrime1', admin.password_hash);
        results.bcrypt = match ? 'password matches' : 'PASSWORD MISMATCH — seed again';
      } else {
        results.bcrypt = 'skipped (no admin found)';
      }
    } catch (e: any) { results.bcrypt = `FAIL: ${e.message}`; }

    // Step 4: JWT sign
    try {
      const token = app.jwt.sign({ sub: 'test', type: 'admin', exp: Math.floor(Date.now()/1000) + 60 });
      results.jwt_sign = token ? `ok (${token.split('.').length} parts)` : 'empty token';
    } catch (e: any) { results.jwt_sign = `FAIL: ${e.message}`; }

    // Step 5: admin_sessions table exists
    try {
      await queryOne('SELECT COUNT(*) FROM admin_sessions');
      results.sessions_table = 'ok';
    } catch (e: any) { results.sessions_table = `FAIL: ${e.message}`; }

    // Step 6: INET cast
    try {
      await queryOne("SELECT '127.0.0.1'::inet as ip");
      results.inet_cast = 'ok';
    } catch (e: any) { results.inet_cast = `FAIL: ${e.message}`; }

    return reply.send(results);
  });

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    let body: { email: string; password: string };
    try {
      body = loginSchema.parse(req.body);
    } catch {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      const result = await loginAdmin(
        body.email,
        body.password,
        req.ip ?? '127.0.0.1',
        req.headers['user-agent'] ?? '',
        (payload) => app.jwt.sign(payload as object),
      );
      return reply.send(result);
    } catch (err: any) {
      const status  = err.statusCode ?? 500;
      const message = err.message   || 'Login failed';
      app.log.error({ status, message, email: body.email }, 'Login error');
      return reply.status(status).send({ error: message });
    }
  });

  // ── REFRESH ────────────────────────────────────────────────────────────────
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = (req.body as any) ?? {};
    if (!refreshToken) return reply.status(400).send({ error: 'refreshToken required' });
    try {
      const accessToken = await refreshAccessToken(
        refreshToken,
        (payload) => app.jwt.sign(payload as object),
      );
      return reply.send({ accessToken });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 401).send({ error: err.message || 'Refresh failed' });
    }
  });

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  app.post('/logout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { refreshToken } = (req.body as any) ?? {};
    if (refreshToken) await revokeSession(refreshToken).catch(() => {});
    return reply.send({ ok: true });
  });

  // ── ME ─────────────────────────────────────────────────────────────────────
  app.get('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    return reply.send({ admin: (req as any).admin });
  });
}
