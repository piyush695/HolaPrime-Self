import { createHmac } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

const BASE = 'https://api.razorpay.com/v1';

export class RazorpayAdapter implements IPaymentGateway {
  readonly name        = 'razorpay';
  readonly displayName = 'Razorpay';

  private readonly authHeader: string;

  constructor(
    private readonly keyId:      string,
    private readonly keySecret:  string,
    private readonly webhookSecret: string,
  ) {
    this.authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  private async req<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Authorization': this.authHeader, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as T;
    if (!res.ok) throw new Error(`Razorpay ${res.status}: ${JSON.stringify((data as any).error)}`);
    return data;
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this.req('/payments?count=1', undefined, 'GET');
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
    }
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    // Razorpay amount is in paise (INR smallest unit)
    const amountPaise = Math.round(params.amount * 100);

    const order = await this.req<{
      id: string; receipt: string; status: string;
    }>('/orders', {
      amount:   amountPaise,
      currency: params.currency || 'INR',
      receipt:  `HP_${(params.metadata?.intentId as string ?? Date.now()).toString().slice(-16)}`,
      notes:    { userId: params.userId, productId: params.productId },
    });

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: order.id,
      status:           'pending',
      instructions: {
        orderId:      order.id,
        keyId:        this.keyId,
        amount:       amountPaise,
        currency:     params.currency || 'INR',
        name:         'Hola Prime Markets',
        description:  'Challenge Fee',
      },
      raw: order as unknown as Record<string, unknown>,
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    const sig      = params.headers['x-razorpay-signature'];
    const expected = createHmac('sha256', params.secret)
      .update(params.rawBody)
      .digest('hex');

    if (expected !== sig) throw new Error('Invalid Razorpay webhook signature');

    const event   = JSON.parse(params.rawBody.toString()) as Record<string, unknown>;
    const payload = (event.payload as any)?.payment?.entity ?? {};

    const statusMap: Record<string, 'completed'|'failed'|'pending'> = {
      'payment.captured': 'completed',
      'payment.failed':   'failed',
    };

    return {
      eventType:        event.event as string,
      gatewayReference: payload.order_id as string,
      status:           statusMap[event.event as string] ?? 'pending',
      amountPaid:       payload.amount ? payload.amount / 100 : undefined,
      currency:         payload.currency as string,
      raw:              event,
    };
  }

  async refund(gatewayReference: string, amount: number) {
    // gatewayReference here is the payment_id not order_id
    const r = await this.req<{ id: string }>(
      `/payments/${gatewayReference}/refund`,
      { amount: Math.round(amount * 100) },
    );
    return { refundId: r.id };
  }
}
