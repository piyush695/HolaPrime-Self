import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listActiveGateways, initiatePayment, processGatewayWebhook,
  checkAllGatewayHealth, clearGatewayCache,
} from './gateway.service.js';
import { query } from '../../db/index.js';

export async function gatewayRoutes(app: FastifyInstance): Promise<void> {
  // ── Public: list available gateways ────────────────────────────────────────
  app.get('/available', async (req, reply) => {
    const q       = req.query as { currency?: string };
    const gateways = await listActiveGateways(q.currency);
    return reply.send(gateways);
  });

  // ── Trader: create checkout intent ─────────────────────────────────────────
  // Note: uses trader auth not admin auth
  app.post('/checkout', async (req, reply) => {
    // Quick trader auth check
    let traderId: string;
    try {
      const p = await req.jwtVerify<{ sub: string; type: string }>();
      if (p.type !== 'trader') return reply.status(401).send({ error: 'Unauthorised' });
      traderId = p.sub;
    } catch {
      return reply.status(401).send({ error: 'Unauthorised' });
    }

    const body = z.object({
      productId:  z.string().uuid(),
      gateway:    z.string(),
      currency:   z.string().length(3).default('USD'),
      successUrl: z.string().url().optional(),
      cancelUrl:  z.string().url().optional(),
    }).parse(req.body);

    const result = await initiatePayment({
      userId:     traderId,
      productId:  body.productId,
      gateway:    body.gateway as any,
      currency:   body.currency,
      successUrl: body.successUrl,
      cancelUrl:  body.cancelUrl,
    });

    return reply.status(201).send(result);
  });

  // ── Webhooks — one endpoint per gateway (no auth — verified by signature) ───
  const GATEWAYS = ['stripe','nowpayments','flutterwave','razorpay','skrill','neteller','paypal'] as const;

  for (const gwName of GATEWAYS) {
    app.post(`/webhook/${gwName}`, {
      config: { rawBody: true }, // needed to verify signatures
    }, async (req, reply) => {
      try {
        await processGatewayWebhook(
          gwName as any,
          req.headers as Record<string, string>,
          Buffer.from(JSON.stringify(req.body)), // raw body
        );
        return reply.status(200).send('OK');
      } catch (err) {
        app.log.error({ err, gateway: gwName }, 'Webhook processing failed');
        return reply.status(400).send('Webhook error');
      }
    });
  }

  // ── Admin: gateway configuration ───────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    const publicPaths = ['/available', '/checkout'];
    const isWebhook   = req.url.includes('/webhook/');
    if (publicPaths.some(p => req.url.endsWith(p)) || isWebhook) return;
    return app.authenticate(req, reply);
  });

  // List all gateways with their config (admin only)
  app.get('/admin', async (_req, reply) => {
    const gateways = await query(`
      SELECT id, name, display_name, description, status,
             supported_currencies, min_amount, max_amount,
             fee_pct, fee_fixed, sort_order, updated_at,
             -- Redact sensitive config fields
             jsonb_strip_nulls(jsonb_build_object(
               'wallets',    config->'wallets',
               'banks',      config->'banks',
               'defaultCoin',config->'defaultCoin',
               'merchantEmail', config->'merchantEmail'
             )) AS safe_config
      FROM payment_gateways ORDER BY sort_order
    `);
    return reply.send(gateways);
  });

  // Update gateway status and config
  app.patch('/admin/:name', async (req, reply) => {
    const { name }   = req.params as { name: string };
    const body       = req.body as {
      status?: string; config?: Record<string, unknown>;
      feeFixed?: number; feePct?: number;
      minAmount?: number; maxAmount?: number;
      sortOrder?: number;
    };

    const sets: string[]  = ['updated_at = NOW()'];
    const vals: unknown[] = [];
    let i = 1;

    if (body.status    !== undefined) { sets.push(`status = $${i++}`);     vals.push(body.status); }
    if (body.config    !== undefined) { sets.push(`config = $${i++}`);     vals.push(JSON.stringify(body.config)); }
    if (body.feePct    !== undefined) { sets.push(`fee_pct = $${i++}`);    vals.push(body.feePct); }
    if (body.feeFixed  !== undefined) { sets.push(`fee_fixed = $${i++}`);  vals.push(body.feeFixed); }
    if (body.minAmount !== undefined) { sets.push(`min_amount = $${i++}`); vals.push(body.minAmount); }
    if (body.maxAmount !== undefined) { sets.push(`max_amount = $${i++}`); vals.push(body.maxAmount); }

    await query(
      `UPDATE payment_gateways SET ${sets.join(', ')} WHERE name = $${i}`,
      [...vals, name],
    );

    // Clear cache so new config is picked up
    clearGatewayCache(name as any);

    return reply.send({ ok: true });
  });

  // Health check all active gateways
  app.get('/admin/health', async (_req, reply) => {
    const health = await checkAllGatewayHealth();
    return reply.send(health);
  });

  // Manual bank transfer confirmation (admin confirms they received the wire)
  app.post('/admin/bank-transfers/:id/confirm', async (req, reply) => {
    const { id }     = req.params as { id: string };
    const admin      = (req as any).admin;

    await query(`
      UPDATE bank_transfer_refs
      SET is_confirmed = true, confirmed_by = $1, confirmed_at = NOW()
      WHERE id = $2
    `, [admin.id, id]);

    // Find the intent and complete the purchase
    const ref = await query(
      'SELECT intent_id, user_id FROM bank_transfer_refs WHERE id = $1', [id],
    );
    if (ref[0]) {
      const intent = await query(
        'SELECT * FROM payment_intents WHERE id = $1', [(ref[0] as any).intent_id],
      );
      if (intent[0]) {
        const i = intent[0] as any;
        const { provisionAccount } = await import('../challenges/challenges.service.js');
        await provisionAccount({ userId: i.user_id, productId: i.product_id, paymentId: i.id });
        await query("UPDATE payment_intents SET status='completed', completed_at=NOW() WHERE id=$1", [i.id]);
      }
    }

    return reply.send({ ok: true });
  });

  // List pending bank transfers
  app.get('/admin/bank-transfers', async (_req, reply) => {
    const transfers = await query(`
      SELECT bt.*, pi.amount, pi.currency, pi.user_id, pi.product_id,
             u.email, u.first_name, u.last_name,
             cp.name AS product_name
      FROM bank_transfer_refs bt
      JOIN payment_intents pi ON pi.id = bt.intent_id
      JOIN users u ON u.id = bt.user_id
      JOIN challenge_products cp ON cp.id = pi.product_id
      WHERE bt.is_confirmed = false
      ORDER BY bt.created_at DESC
    `);
    return reply.send(transfers);
  });

  // List pending crypto deposits (manual)
  app.get('/admin/crypto-deposits', async (_req, reply) => {
    const deposits = await query(`
      SELECT cd.*, pi.amount_usd, pi.product_id,
             u.email, u.first_name, u.last_name,
             cp.name AS product_name
      FROM crypto_deposits cd
      JOIN payment_intents pi ON pi.id = cd.intent_id
      JOIN users u ON u.id = cd.user_id
      JOIN challenge_products cp ON cp.id = pi.product_id
      WHERE cd.is_confirmed = false
        AND cd.expires_at > NOW()
      ORDER BY cd.created_at DESC
    `);
    return reply.send(deposits);
  });

  app.post('/admin/crypto-deposits/:id/confirm', async (req, reply) => {
    const { id }  = req.params as { id: string };
    const { txHash, amount } = z.object({
      txHash: z.string().min(10),
      amount: z.number().positive(),
    }).parse(req.body);

    await query(`
      UPDATE crypto_deposits
      SET is_confirmed = true, confirmed_at = NOW(), tx_hash = $1, received_amount = $2
      WHERE id = $3
    `, [txHash, amount, id]);

    // Same completion logic as bank transfer
    const dep = await query(
      'SELECT intent_id, user_id FROM crypto_deposits WHERE id = $1', [id],
    );
    if (dep[0]) {
      const d = dep[0] as any;
      const intent = await query('SELECT * FROM payment_intents WHERE id = $1', [d.intent_id]);
      if (intent[0]) {
        const i = intent[0] as any;
        const { provisionAccount } = await import('../challenges/challenges.service.js');
        await provisionAccount({ userId: i.user_id, productId: i.product_id, paymentId: i.id });
        await query("UPDATE payment_intents SET status='completed', completed_at=NOW() WHERE id=$1", [i.id]);
      }
    }
    return reply.send({ ok: true });
  });
}
