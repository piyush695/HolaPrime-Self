import { createHmac } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

const BASE = 'https://api.flutterwave.com/v3';

export class FlutterwaveAdapter implements IPaymentGateway {
  readonly name        = 'flutterwave';
  readonly displayName = 'Flutterwave';

  constructor(
    private readonly secretKey:      string,
    private readonly publicKey:      string,
    private readonly encryptionKey:  string,
    private readonly webhookSecret:  string,
  ) {}

  private async req<T>(path: string, body?: unknown, method = 'GET'): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as { status: string; data: T; message?: string };
    if (data.status !== 'success') throw new Error(`Flutterwave: ${data.message ?? JSON.stringify(data)}`);
    return data.data;
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      // Ping banks endpoint as a lightweight health check
      await this.req('/banks/NG');
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
    }
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const txRef = `HP_${params.metadata?.intentId ?? Date.now()}`;
    const redirectUrl = params.successUrl ?? `${process.env.APP_URL ?? 'https://app.holaprime.com'}/checkout/complete`;

    const link = await this.req<{
      link: string;
    }>('/payments', {
      tx_ref:       txRef,
      amount:       params.amount,
      currency:     params.currency,
      redirect_url: redirectUrl,
      meta:         { userId: params.userId, productId: params.productId },
      customer:     { email: params.metadata?.email, name: params.metadata?.name },
      customizations: { title: 'Hola Prime Challenge', logo: 'https://holaprime.com/logo.png' },
    }, 'POST');

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: txRef,
      status:           'pending',
      redirectUrl:      link.link,
      raw:              link as unknown as Record<string, unknown>,
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    const sig = params.headers['verif-hash'];
    if (!sig || sig !== params.secret) {
      throw new Error('Invalid Flutterwave webhook signature');
    }

    const event = JSON.parse(params.rawBody.toString()) as Record<string, unknown>;
    const data  = event.data as Record<string, unknown>;

    const statusMap: Record<string, 'completed'|'failed'|'pending'> = {
      successful: 'completed', completed: 'completed',
      failed: 'failed', cancelled: 'failed',
    };

    return {
      eventType:        event.event as string,
      gatewayReference: (data.tx_ref ?? data.flw_ref) as string,
      status:           statusMap[data.status as string] ?? 'pending',
      amountPaid:       data.amount_settled as number ?? data.amount as number,
      currency:         data.currency as string,
      raw:              event,
    };
  }

  async checkStatus(gatewayReference: string) {
    const tx = await this.req<{ data: { status: string; amount_settled: number } }>(
      `/transactions/${gatewayReference}/verify`, undefined, 'GET',
    );
    const d = (tx as any).data ?? tx;
    return {
      status: d.status === 'successful' ? 'completed' as const : 'pending' as const,
      amountPaid: d.amount_settled,
    };
  }

  async refund(gatewayReference: string, amount: number) {
    const r = await this.req<{ id: number }>(
      `/transactions/${gatewayReference}/refund`, { amount }, 'POST',
    );
    return { refundId: String(r.id) };
  }
}
