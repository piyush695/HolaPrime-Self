import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '../../db/index.js';
import { verifyOTP, checkLoginRateLimit, recordLoginAttempt } from '../otp/otp.service.js';
import { fireEvent } from '../integrations/event-bus.js';
import { randomBytes } from 'crypto';
import { upsertContact } from '../crm/crm.service.js';
import { getAllSettings } from '../settings/settings.service.js';

// ── Trader auth (separate from admin auth) ────────────────────────────────────
async function traderAuth(req: any, reply: any): Promise<void> {
  try {
    const payload = await req.jwtVerify<{ sub: string; type: string }>();
    if (payload.type !== 'trader') {
      return reply.status(401).send({ error: 'Unauthorised' });
    }
    const user = await queryOne<{ id: string; status: string; email: string }>(
      'SELECT id, status, email FROM users WHERE id = $1', [payload.sub],
    );
    if (!user || user.status === 'banned') {
      return reply.status(401).send({ error: 'Unauthorised' });
    }
    (req as any).trader = user;
  } catch {
    return reply.status(401).send({ error: 'Unauthorised' });
  }
}

export async function traderRoutes(app: FastifyInstance): Promise<void> {
  // ── Public settings (for landing page / app config) ──────────────────────
  app.get('/config', async (_req, reply) => {
    const { settings } = await getAllSettings(true);
    return reply.send(settings);
  });

  // ── Register ──────────────────────────────────────────────────────────────
  app.post('/register', async (req, reply) => {
    const body = z.object({
      email:       z.string().email(),
      password:    z.string().min(8),
      firstName:   z.string().min(1),
      lastName:    z.string().min(1),
      countryCode: z.string().length(2).optional(),
      phone:       z.string().optional(),
      utmSource:   z.string().optional(),
      utmMedium:   z.string().optional(),
      utmCampaign: z.string().optional(),
      referralCode:z.string().optional(),
    }).parse(req.body);

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [body.email.toLowerCase()]);
    if (existing) return reply.status(409).send({ error: 'An account with this email already exists.' });

    // OTP verification: optional, not enforced at registration

    const hash = await bcrypt.hash(body.password, 12);

    // Check referral
    let referredBy: string | null = null;
    if (body.referralCode) {
      const ref = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE referral_code = $1', [body.referralCode],
      );
      referredBy = ref?.id ?? null;
    }

    const userId = await withTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO users
          (email, password_hash, first_name, last_name, country_code, phone,
           status, referred_by, utm_source, utm_medium, utm_campaign)
        VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10)
        RETURNING id
      `, [
        body.email.toLowerCase(), hash, body.firstName, body.lastName,
        body.countryCode ?? null, body.phone ?? null, referredBy,
        body.utmSource ?? null, body.utmMedium ?? null, body.utmCampaign ?? null,
      ]);
      return result.rows[0].id as string;
    });

    // Mark email as verified
    await query('UPDATE users SET email_verified=true, email_verified_at=NOW() WHERE id=$1', [userId]).catch(()=>{});

    // Fire S2S event — user registered
    fireEvent('user.registered', {
      userId: userId, email: body.email,
      firstName: body.firstName, lastName: body.lastName,
      countryCode: body.countryCode,
      utmSource: body.utmSource, utmMedium: body.utmMedium, utmCampaign: body.utmCampaign,
    }).catch(console.error);

    // Create CRM contact (non-blocking — failure must not break registration)
    upsertContact({
      email: body.email, firstName: body.firstName, lastName: body.lastName,
      phone: body.phone, countryCode: body.countryCode,
      source: body.utmSource ? 'paid_search' : body.referralCode ? 'referral' : 'organic',
      utmSource: body.utmSource, utmMedium: body.utmMedium, utmCampaign: body.utmCampaign,
      userId,
    }).catch((err) => console.error('[CRM] upsertContact failed on registration:', err));

    const token = app.jwt.sign({ sub: userId, type: 'trader' });
    return reply.status(201).send({ token, userId });
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const user = await queryOne<{
      id: string; password_hash: string; status: string;
      first_name: string; last_name: string; email: string;
    }>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });
    if (user.status === 'banned') return reply.status(403).send({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token        = app.jwt.sign({ sub: user.id, type: 'trader' });
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'trader_refresh' }, { expiresIn: '7d' });

    return reply.send({
      token, refreshToken,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
    });
  });

  // ── Protected trader routes ───────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    const pub = ['/api/v1/trader/register', '/api/v1/trader/login', '/api/v1/trader/config', '/api/v1/trader/forgot-password', '/api/v1/trader/reset-password', '/api/v1/trader/otp/send', '/api/v1/trader/otp/verify'];
    if (pub.some(p => req.url === p)) return;
    return traderAuth(req, reply);
  });

  // Profile
  app.get('/me', async (req, reply) => {
    const trader = (req as any).trader;
    const user   = await queryOne(`
      SELECT id, email, first_name, last_name, phone, country_code,
             date_of_birth, status, kyc_status, referral_code, created_at
      FROM users WHERE id = $1
    `, [trader.id]);
    return reply.send(user);
  });

  // My accounts
  app.get('/accounts', async (req, reply) => {
    const trader = (req as any).trader;
    const accounts = await query(`
      SELECT ta.*,
        cp.name AS product_name, cp.profit_split, cp.payout_frequency,
        cp.phases AS product_phases
      FROM trading_accounts ta
      JOIN challenge_products cp ON cp.id = ta.product_id
      WHERE ta.user_id = $1
      ORDER BY ta.created_at DESC
    `, [trader.id]);
    return reply.send(accounts);
  });

  // Single account detail + snapshots + trades
  app.get('/accounts/:id', async (req, reply) => {
    const { id }   = req.params as { id: string };
    const trader   = (req as any).trader;

    const account = await queryOne(`
      SELECT ta.*, cp.name AS product_name, cp.phases AS product_phases,
             cp.profit_split, cp.leverage, cp.instruments_allowed
      FROM trading_accounts ta
      JOIN challenge_products cp ON cp.id = ta.product_id
      WHERE ta.id = $1 AND ta.user_id = $2
    `, [id, trader.id]);

    if (!account) return reply.status(404).send({ error: 'Not found' });

    const snapshots = await query(
      'SELECT * FROM account_snapshots WHERE account_id = $1 ORDER BY snapshot_date DESC LIMIT 30', [id],
    );
    const trades = await query(
      'SELECT * FROM account_trades WHERE account_id = $1 ORDER BY open_time DESC LIMIT 50', [id],
    );

    return reply.send({ ...account, snapshots, trades });
  });

  // Available challenge products
  app.get('/products', async (_req, reply) => {
    const products = await query(`
      SELECT id, name, slug, description, account_size, fee, currency,
             platform, phases, leverage, instruments_allowed, news_trading_allowed,
             weekend_holding_allowed, scaling_plan, profit_split, payout_frequency
      FROM challenge_products
      WHERE status = 'active'
      ORDER BY sort_order, account_size
    `);
    return reply.send(products);
  });

  // KYC submission
  app.post('/kyc', async (req, reply) => {
    const trader = (req as any).trader;
    const user   = await queryOne<{ kyc_status: string }>(
      'SELECT kyc_status FROM users WHERE id = $1', [trader.id],
    );
    if (user?.kyc_status === 'approved') {
      return reply.status(409).send({ error: 'KYC already approved' });
    }

    const [sub] = await query<{ id: string }>(`
      INSERT INTO kyc_submissions (user_id, status)
      VALUES ($1, 'pending') RETURNING id
    `, [trader.id]);

    await query(
      'UPDATE users SET kyc_status = $1 WHERE id = $2',
      ['pending', trader.id],
    );

    return reply.status(201).send({ submissionId: sub.id });
  });

  // Notifications
  app.get('/notifications', async (req, reply) => {
    const trader = (req as any).trader;
    const notifs = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [trader.id],
    );
    return reply.send(notifs);
  });

  app.post('/notifications/read-all', async (req, reply) => {
    const trader = (req as any).trader;
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [trader.id]);
    return reply.send({ ok: true });
  });

  // Support tickets
  app.get('/tickets', async (req, reply) => {
    const trader   = (req as any).trader;
    const tickets  = await query(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC', [trader.id],
    );
    return reply.send(tickets);
  });

  app.post('/tickets', async (req, reply) => {
    const trader = (req as any).trader;
    const { subject, message: body, priority } = z.object({
      subject:  z.string().min(3),
      body:     z.string().min(10),
      priority: z.enum(['low','normal','high']).default('normal'),
    }).parse(req.body);

    const [t] = await query<{ id: string }>(`
      INSERT INTO support_tickets (user_id, subject, message, priority, ticket_no, category)
      VALUES ($1,$2,$3,$4) RETURNING id
    `, [trader.id, subject, body, priority, 'HP-' + Date.now().toString(36).toUpperCase().slice(-6), 'general']);

    return reply.status(201).send({ id: t.id });
  });

  app.post('/tickets/:id/messages', async (req, reply) => {
    const { id }   = req.params as { id: string };
    const trader   = (req as any).trader;
    const { body } = z.object({ body: z.string().min(1) }).parse(req.body);

    const ticket = await queryOne('SELECT id FROM support_tickets WHERE id = $1 AND user_id = $2', [id, trader.id]);
    if (!ticket) return reply.status(404).send({ error: 'Not found' });

    await query(`
      INSERT INTO support_messages (ticket_id, sender_id, is_admin, body)
      VALUES ($1,$2,false,$3)
    `, [id, trader.id, body]);

    return reply.status(201).send({ ok: true });
  });

  // Payout request
  app.post('/payout-requests', async (req, reply) => {
    const trader = (req as any).trader;
    const { accountId, amount, method, details } = z.object({
      accountId: z.string().uuid(),
      amount:    z.number().positive(),
      method:    z.string().min(1),
      details:   z.record(z.unknown()),
    }).parse(req.body);

    const account = await queryOne<{
      id: string; status: string; current_balance: number;
      starting_balance: number; profit_split: number;
    }>(`
      SELECT ta.*, cp.profit_split
      FROM trading_accounts ta
      JOIN challenge_products cp ON cp.id = ta.product_id
      WHERE ta.id = $1 AND ta.user_id = $2 AND ta.status = 'funded'
    `, [accountId, trader.id]);

    if (!account) return reply.status(404).send({ error: 'Funded account not found' });

    const traderAmount = amount * (account.profit_split / 100);
    const today        = new Date().toISOString().split('T')[0];
    const monthStart   = today.slice(0, 7) + '-01';

    const [pr] = await query<{ id: string }>(`
      INSERT INTO payout_requests
        (user_id, account_id, amount, profit_split_pct, trader_amount,
         withdrawal_method, withdrawal_details, period_start, period_end)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, [
      trader.id, accountId, amount, account.profit_split, traderAmount,
      method, JSON.stringify(details), monthStart, today,
    ]);

    return reply.status(201).send({ id: pr.id, traderAmount });
  });

  // ── Forgot password ────────────────────────────────────────────────────────
  app.post('/forgot-password', async (req, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await queryOne<{ id: string; first_name: string }>(
      'SELECT id, first_name FROM users WHERE email = $1', [email.toLowerCase()],
    );

    // Always return success to prevent email enumeration
    if (!user) return reply.send({ ok: true });

    const token   = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires_at = $2 WHERE id = $3`,
      [token, expires.toISOString(), user.id],
    );

    // In production this would send an email — for now log the reset URL
    app.log.info({ resetUrl: `/reset-password?token=${token}` }, 'Password reset requested');

    return reply.send({ ok: true });
  });

  // ── Reset password ─────────────────────────────────────────────────────────
  app.post('/reset-password', async (req, reply) => {
    const { token, password } = z.object({
      token:    z.string().min(1),
      password: z.string().min(8),
    }).parse(req.body);

    const user = await queryOne<{ id: string }>(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires_at > NOW()`,
      [token],
    );

    if (!user) return reply.status(400).send({ error: 'Invalid or expired reset link. Please request a new one.' });

    const hash = await bcrypt.hash(password, 12);
    await query(
      `UPDATE users
       SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL
       WHERE id = $2`,
      [hash, user.id],
    );

    return reply.send({ ok: true });
  });
}
