import { createHmac } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

const BASE = 'https://api.nowpayments.io/v1';

export class NowPaymentsAdapter implements IPaymentGateway {
  readonly name        = 'nowpayments';
  readonly displayName = 'Crypto (NOWPayments)';

  constructor(
    private readonly apiKey:     string,
    private readonly ipnSecret:  string,
    private readonly coin:       string = 'USDTTRC20', // default coin
  ) {}

  private async req<T>(path: string, body?: unknown, method = 'GET'): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'x-api-key':    this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as T;
    if (!res.ok) throw new Error(`NOWPayments ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this.req('/status');
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
    }
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const payment = await this.req<{
      payment_id: string;
      pay_address: string;
      pay_amount: number;
      pay_currency: string;
      expiration_estimate_date: string;
    }>('/payment', {
      price_amount:   params.amountUsd,
      price_currency: 'usd',
      pay_currency:   this.coin.toLowerCase(),
      order_id:       params.metadata?.intentId,
      order_description: `Hola Prime Challenge — ${params.productId}`,
      ipn_callback_url: process.env.API_BASE_URL
        ? `${process.env.API_BASE_URL}/api/v1/payments-gateway/webhook/nowpayments`
        : undefined,
    }, 'POST');

    // Detect network from coin name
    const network = this.coin.toUpperCase().includes('TRC') ? 'TRC-20'
                  : this.coin.toUpperCase().includes('BEP') ? 'BEP-20'
                  : this.coin.toUpperCase().includes('ERC') ? 'ERC-20'
                  : 'Mainnet';

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: payment.payment_id,
      status:           'pending',
      walletAddress:    payment.pay_address,
      coin:             payment.pay_currency.toUpperCase(),
      network,
      expectedAmount:   payment.pay_amount,
      expiresAt:        new Date(payment.expiration_estimate_date),
      raw:              payment as unknown as Record<string, unknown>,
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    const sig  = params.headers['x-nowpayments-sig'];
    if (!sig) throw new Error('Missing x-nowpayments-sig header');

    // Sort body keys alphabetically, compute HMAC
    const body   = JSON.parse(params.rawBody.toString()) as Record<string, unknown>;
    const sorted = Object.keys(body).sort().reduce((acc, k) => { (acc as any)[k] = body[k]; return acc; }, {});
    const expected = createHmac('sha512', params.secret)
      .update(JSON.stringify(sorted))
      .digest('hex');

    if (expected !== sig) throw new Error('Invalid NOWPayments IPN signature');

    const statusMap: Record<string, 'completed'|'failed'|'pending'> = {
      finished: 'completed', confirmed: 'completed',
      failed: 'failed', expired: 'failed', refunded: 'failed',
      waiting: 'pending', confirming: 'pending', sending: 'pending',
    };

    return {
      eventType:        `payment.${body.payment_status}`,
      gatewayReference: String(body.payment_id),
      status:           statusMap[String(body.payment_status)] ?? 'pending',
      amountPaid:       body.actually_paid as number,
      currency:         (body.pay_currency as string)?.toUpperCase(),
      raw:              body,
    };
  }

  async checkStatus(gatewayReference: string) {
    const p = await this.req<{ payment_status: string; actually_paid: number }>(`/payment/${gatewayReference}`);
    const statusMap: Record<string, 'completed'|'failed'|'pending'> = {
      finished:'completed', confirmed:'completed',
      failed:'failed', expired:'failed',
    };
    return {
      status: statusMap[p.payment_status] ?? 'pending' as const,
      amountPaid: p.actually_paid,
    };
  }
}
