import { createHmac } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

const ENDPOINTS: Record<string, string> = {
  sandbox:    'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
};

export class PayPalAdapter implements IPaymentGateway {
  readonly name        = 'paypal';
  readonly displayName = 'PayPal';

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly clientId:     string,
    private readonly clientSecret: string,
    private readonly webhookId:    string,
    private readonly env:          'sandbox' | 'production' = 'production',
  ) {}

  private get base() { return ENDPOINTS[this.env]; }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;

    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res   = await fetch(`${this.base}/v1/oauth2/token`, {
      method:  'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    'grant_type=client_credentials',
    });
    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken    = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const res   = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Prefer':         'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as T;
    if (!res.ok) throw new Error(`PayPal ${res.status}: ${JSON.stringify((data as any).details ?? data)}`);
    return data;
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this.getToken();
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
    }
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const returnUrl = params.successUrl ?? `${process.env.APP_URL ?? 'https://app.holaprime.com'}/checkout/complete`;
    const cancelUrl = params.cancelUrl  ?? `${process.env.APP_URL ?? 'https://app.holaprime.com'}/checkout/cancel`;

    const order = await this.req<{
      id: string;
      links: Array<{ rel: string; href: string; method: string }>;
    }>('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        amount:      { currency_code: 'USD', value: params.amountUsd.toFixed(2) },
        description: 'Hola Prime Challenge Fee',
        custom_id:   params.metadata?.intentId,
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name:                'Hola Prime Markets',
            locale:                    'en-US',
            landing_page:              'LOGIN',
            return_url:                returnUrl,
            cancel_url:                cancelUrl,
          },
        },
      },
    });

    const approveUrl = order.links.find(l => l.rel === 'payer-action')?.href ?? '';

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: order.id,
      status:           'pending',
      redirectUrl:      approveUrl,
      raw:              order as unknown as Record<string, unknown>,
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    // PayPal webhook verification via their verification API
    const headers = params.headers;
    const verifyRes = await this.req<{ verification_status: string }>(
      'POST', '/v1/notifications/verify-webhook-signature',
      {
        auth_algo:         headers['paypal-auth-algo'],
        cert_url:          headers['paypal-cert-url'],
        transmission_id:   headers['paypal-transmission-id'],
        transmission_sig:  headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id:        this.webhookId,
        webhook_event:     JSON.parse(params.rawBody.toString()),
      },
    );

    if (verifyRes.verification_status !== 'SUCCESS') {
      throw new Error('Invalid PayPal webhook signature');
    }

    const event    = JSON.parse(params.rawBody.toString()) as Record<string, unknown>;
    const resource = event.resource as Record<string, unknown>;

    const statusMap: Record<string, 'completed'|'failed'|'pending'> = {
      'PAYMENT.CAPTURE.COMPLETED': 'completed',
      'PAYMENT.CAPTURE.DENIED':    'failed',
      'PAYMENT.CAPTURE.REVERSED':  'failed',
    };

    return {
      eventType:        event.event_type as string,
      gatewayReference: (resource.supplementary_data as any)?.related_ids?.order_id ?? resource.id as string ?? '',
      status:           statusMap[event.event_type as string] ?? 'pending',
      amountPaid:       (resource.amount as any)?.value ? parseFloat((resource.amount as any).value) : undefined,
      currency:         (resource.amount as any)?.currency_code as string,
      raw:              event,
    };
  }

  async refund(gatewayReference: string, amount: number) {
    // gatewayReference here should be the capture ID
    const r = await this.req<{ id: string }>(
      'POST', `/v2/payments/captures/${gatewayReference}/refund`,
      { amount: { value: amount.toFixed(2), currency_code: 'USD' } },
    );
    return { refundId: r.id };
  }
}
