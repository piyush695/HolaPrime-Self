import { query, queryOne } from '../../db/index.js';
import type { IPaymentGateway } from './gateway.interface.js';
import { StripeAdapter }        from './stripe/stripe.adapter.js';
import { NowPaymentsAdapter }   from './crypto/nowpayments.adapter.js';
import { ManualCryptoAdapter }  from './crypto/manual-crypto.adapter.js';
import { FlutterwaveAdapter }   from './flutterwave/flutterwave.adapter.js';
import { RazorpayAdapter }      from './razorpay/razorpay.adapter.js';
import { SkrillAdapter, NetellerAdapter } from './skrill/skrill-neteller.adapters.js';
import { BankTransferAdapter }  from './bank/bank-transfer.adapter.js';
import { PayPalAdapter }         from './paypal/paypal.adapter.js';

type GatewayName =
  | 'stripe' | 'crypto_manual' | 'nowpayments' | 'coinbase_commerce'
  | 'skrill'  | 'neteller'      | 'bank_transfer'
  | 'flutterwave' | 'razorpay'  | 'paypal';

// Cache instantiated adapters (reload on config change)
const cache = new Map<GatewayName, IPaymentGateway>();

export async function getPaymentGateway(name: GatewayName): Promise<IPaymentGateway> {
  if (cache.has(name)) return cache.get(name)!;

  const gw = await queryOne<{ config: Record<string, string>; status: string }>(
    'SELECT config, status FROM payment_gateways WHERE name = $1', [name],
  );

  if (!gw) throw new Error(`Gateway '${name}' not found in database`);
  if (gw.status === 'inactive') throw new Error(`Gateway '${name}' is not active`);

  const cfg = typeof gw.config === 'string' ? JSON.parse(gw.config) : gw.config;
  let adapter: IPaymentGateway;

  switch (name) {
    case 'stripe':
      adapter = new StripeAdapter(cfg.secretKey, cfg.webhookSecret, cfg.publishableKey);
      break;

    case 'nowpayments':
      adapter = new NowPaymentsAdapter(cfg.apiKey, cfg.ipnSecret, cfg.defaultCoin);
      break;

    case 'crypto_manual':
      adapter = new ManualCryptoAdapter(cfg);
      break;

    case 'flutterwave':
      adapter = new FlutterwaveAdapter(cfg.secretKey, cfg.publicKey, cfg.encryptionKey, cfg.webhookSecret);
      break;

    case 'razorpay':
      adapter = new RazorpayAdapter(cfg.keyId, cfg.keySecret, cfg.webhookSecret);
      break;

    case 'skrill':
      adapter = new SkrillAdapter(cfg.merchantEmail, cfg.secretWord, cfg.merchantId);
      break;

    case 'neteller':
      adapter = new NetellerAdapter(cfg.clientId, cfg.clientSecret, cfg.env ?? 'production');
      break;

    case 'paypal':
      adapter = new PayPalAdapter(cfg.clientId, cfg.clientSecret, cfg.webhookId, cfg.env ?? 'production');
      break;

    case 'bank_transfer':
      adapter = new BankTransferAdapter(cfg);
      break;

    default:
      throw new Error(`No adapter implemented for gateway '${name}'`);
  }

  cache.set(name, adapter);
  return adapter;
}

export function clearGatewayCache(name?: GatewayName) {
  if (name) cache.delete(name);
  else cache.clear();
}

// ── List active gateways (called by trader portal to show payment options) ────
export async function listActiveGateways(currency?: string) {
  const rows = await query(`
    SELECT id, name, display_name, description, logo_url,
           supported_currencies, min_amount, max_amount,
           fee_pct, fee_fixed, sort_order
    FROM payment_gateways
    WHERE status IN ('active', 'test_mode')
      ${currency ? `AND ($1 = ANY(supported_currencies) OR array_length(supported_currencies, 1) = 0)` : ''}
    ORDER BY sort_order
  `, currency ? [currency] : []);
  return rows;
}

// ── Health check all active gateways ──────────────────────────────────────────
export async function checkAllGatewayHealth(): Promise<Record<string, { ok: boolean; latencyMs: number; message?: string }>> {
  const active = await query<{ name: GatewayName }>(
    `SELECT name FROM payment_gateways WHERE status = 'active'`,
  );

  const results: Record<string, { ok: boolean; latencyMs: number; message?: string }> = {};

  await Promise.allSettled(
    active.map(async ({ name }) => {
      try {
        const gw = await getPaymentGateway(name);
        results[name] = await gw.healthCheck();
      } catch (err) {
        results[name] = { ok: false, latencyMs: 0, message: String(err) };
      }
    }),
  );

  return results;
}

// ── Create a payment intent (called from checkout) ────────────────────────────
export async function initiatePayment(params: {
  userId:    string;
  productId: string;
  gateway:   GatewayName;
  currency:  string;
  successUrl?: string;
  cancelUrl?:  string;
  metadata?: Record<string, unknown>;
}) {
  // Get product price
  const product = await queryOne<{
    id: string; fee: number; account_size: number;
  }>('SELECT id, fee, account_size FROM challenge_products WHERE id = $1', [params.productId]);

  if (!product) throw new Error('Product not found');

  // Get gateway fee
  const gw = await queryOne<{ fee_pct: number; fee_fixed: number }>(
    'SELECT fee_pct, fee_fixed FROM payment_gateways WHERE name = $1', [params.gateway],
  );

  const amount    = parseFloat(String(product.fee));
  const amountUsd = amount; // TODO: FX conversion if currency !== USD
  const fee       = amountUsd * ((gw?.fee_pct ?? 0) / 100) + (gw?.fee_fixed ?? 0);
  const total     = amountUsd + fee;

  // Create intent record
  const [intent] = await query<{ id: string }>(`
    INSERT INTO payment_intents
      (user_id, product_id, gateway, amount, currency, amount_usd, status)
    VALUES ($1,$2,$3,$4,$5,$6,'pending')
    RETURNING id
  `, [params.userId, params.productId, params.gateway, total, params.currency, amountUsd]);

  // Call the gateway adapter
  const adapter = await getPaymentGateway(params.gateway);
  const result  = await adapter.createIntent({
    userId:    params.userId,
    productId: params.productId,
    amount:    total,
    currency:  params.currency,
    amountUsd,
    successUrl: params.successUrl,
    cancelUrl:  params.cancelUrl,
    metadata:   { ...params.metadata, intentId: intent.id },
  });

  // Store gateway reference
  await query(
    'UPDATE payment_intents SET gateway_reference = $1, gateway_response = $2 WHERE id = $3',
    [result.gatewayReference, JSON.stringify(result.raw ?? {}), intent.id],
  );

  return { ...result, intentId: intent.id };
}

// ── Process a webhook from any gateway ───────────────────────────────────────
export async function processGatewayWebhook(
  gatewayName: GatewayName,
  headers: Record<string, string>,
  rawBody: Buffer,
): Promise<void> {
  const gw  = await queryOne<{ config: Record<string, string> }>(
    'SELECT config FROM payment_gateways WHERE name = $1', [gatewayName],
  );
  if (!gw) throw new Error(`Gateway not found: ${gatewayName}`);

  const cfg     = typeof gw.config === 'string' ? JSON.parse(gw.config) : gw.config;
  const adapter = await getPaymentGateway(gatewayName);

  const event = await adapter.verifyWebhook({
    headers,
    rawBody,
    secret: cfg.webhookSecret ?? cfg.ipnSecret ?? cfg.secretWord ?? '',
  });

  if (!event.gatewayReference) return;

  const intent = await queryOne<{ id: string; user_id: string; product_id: string }>(
    'SELECT * FROM payment_intents WHERE gateway_reference = $1', [event.gatewayReference],
  );

  if (!intent) return;

  if (event.status === 'completed') {
    await completePurchase(intent.id, intent.user_id, intent.product_id, event.amountPaid);
  } else if (event.status === 'failed') {
    await query(
      "UPDATE payment_intents SET status = 'failed', updated_at = NOW() WHERE id = $1",
      [intent.id],
    );
  }
}

// ── Complete purchase — provision the trading account ────────────────────────
async function completePurchase(
  intentId: string,
  userId: string,
  productId: string,
  amountPaid?: number,
): Promise<void> {
  const { withTransaction } = await import('../../db/index.js');

  await withTransaction(async (client) => {
    // Mark intent completed
    await client.query(
      "UPDATE payment_intents SET status = 'completed', completed_at = NOW() WHERE id = $1",
      [intentId],
    );

    // Create payment record
    const payResult = await client.query(`
      INSERT INTO payments (user_id, type, status, amount, currency, method, description)
      VALUES ($1, 'challenge_fee', 'completed', $2, 'USD', 'gateway', 'Challenge purchase')
      RETURNING id
    `, [userId, amountPaid ?? 0]);
    const paymentId = payResult.rows[0].id;

    // Provision trading account
    const { provisionAccount } = await import('../challenges/challenges.service.js');
    await provisionAccount({ userId, productId, paymentId });

    // Fire webhook event
    const { dispatchWebhookEvent } = await import('../webhooks/webhooks.service.js');
    await dispatchWebhookEvent('payment.completed', { userId, productId, intentId, amount: amountPaid });

    // S2S events
    const { fireEvent } = await import('../integrations/event-bus.js');
    const product = await queryOne<{ name: string; fee: number }>('SELECT name, fee FROM challenge_products WHERE id = $1', [productId]);
    const user    = await queryOne<{ email: string; first_name: string; last_name: string; country_code: string }>('SELECT email, first_name, last_name, country_code FROM users WHERE id = $1', [userId]);
    await fireEvent('payment.completed', {
      userId,
      email:       user?.email,
      firstName:   user?.first_name,
      lastName:    user?.last_name,
      countryCode: user?.country_code,
      value:       amountPaid ?? parseFloat(String(product?.fee ?? 0)),
      currency:    'USD',
      productId,
      productName: product?.name,
      orderId:     intentId,
    }).catch(console.error);
  });
}
