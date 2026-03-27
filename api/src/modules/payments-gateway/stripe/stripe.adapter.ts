import { createHmac, timingSafeEqual } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

export class StripeAdapter implements IPaymentGateway {
  readonly name        = 'stripe';
  readonly displayName = 'Credit / Debit Card';

  constructor(
    private readonly secretKey:     string,
    private readonly webhookSecret: string,
    private readonly publishableKey: string,
  ) {}

  private async stripe(path: string, body?: Record<string, unknown>, method = 'POST') {
    const encoded = body
      ? Object.entries(this.flattenForStripe(body))
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : undefined;

    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        'Authorization':  `Bearer ${this.secretKey}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      },
      body: encoded,
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${(data.error as any)?.message ?? JSON.stringify(data)}`);
    return data;
  }

  // Stripe needs nested objects flattened: { metadata: {a:'1'} } → 'metadata[a]=1'
  private flattenForStripe(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(out, this.flattenForStripe(v as Record<string, unknown>, key));
      } else if (v !== null && v !== undefined) {
        out[key] = String(v);
      }
    }
    return out;
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this.stripe('/account', undefined, 'GET');
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
    }
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const amountCents = Math.round(params.amountUsd * 100);

    // Create Stripe PaymentIntent
    const pi = await this.stripe('/payment_intents', {
      amount:   amountCents,
      currency: 'usd',
      metadata: {
        userId:    params.userId,
        productId: params.productId,
        intentId:  params.metadata?.intentId as string ?? '',
      },
      automatic_payment_methods: { enabled: 'true' },
    });

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: pi.id as string,
      status:           'pending',
      raw:              pi,
      // Client secret returned so the frontend can use Stripe.js
      instructions: {
        clientSecret:    pi.client_secret,
        publishableKey:  this.publishableKey,
      },
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    const sigHeader = params.headers['stripe-signature'];
    if (!sigHeader) throw new Error('Missing Stripe-Signature header');

    // Parse header
    const parts    = sigHeader.split(',');
    const tPart    = parts.find(p => p.startsWith('t='));
    const v1Part   = parts.find(p => p.startsWith('v1='));
    if (!tPart || !v1Part) throw new Error('Invalid Stripe-Signature format');

    const timestamp   = tPart.slice(2);
    const signature   = v1Part.slice(3);
    const payload     = `${timestamp}.${params.rawBody}`;
    const expected    = createHmac('sha256', params.secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf   = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new Error('Invalid Stripe webhook signature');
    }

    const event  = JSON.parse(params.rawBody.toString()) as Record<string, unknown>;
    const intent = (event.data as any)?.object;

    const statusMap: Record<string, 'completed' | 'failed' | 'pending'> = {
      'payment_intent.succeeded': 'completed',
      'payment_intent.payment_failed': 'failed',
    };

    return {
      eventType:        event.type as string,
      gatewayReference: intent?.id ?? '',
      status:           statusMap[event.type as string] ?? 'pending',
      amountPaid:       intent?.amount_received ? intent.amount_received / 100 : undefined,
      currency:         (intent?.currency as string)?.toUpperCase(),
      raw:              event,
    };
  }

  async checkStatus(gatewayReference: string) {
    const pi = await this.stripe(`/payment_intents/${gatewayReference}`, undefined, 'GET');
    return {
      status: pi.status === 'succeeded' ? 'completed' as const
            : pi.status === 'canceled'  ? 'failed' as const
            : 'pending' as const,
      amountPaid: pi.amount_received ? (pi.amount_received as number) / 100 : undefined,
    };
  }

  async refund(gatewayReference: string, amount: number, reason?: string) {
    const ref = await this.stripe('/refunds', {
      payment_intent: gatewayReference,
      amount:         Math.round(amount * 100),
      reason:         reason ?? 'requested_by_customer',
    });
    return { refundId: ref.id as string };
  }
}
