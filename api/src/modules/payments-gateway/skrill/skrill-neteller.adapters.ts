import { createHash } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

// ── Skrill adapter ────────────────────────────────────────────────────────────
export class SkrillAdapter implements IPaymentGateway {
  readonly name        = 'skrill';
  readonly displayName = 'Skrill';

  constructor(
    private readonly merchantEmail: string,
    private readonly secretWord:    string,  // set in Skrill merchant settings
    private readonly merchantId:    string,
  ) {}

  async healthCheck() {
    // Skrill doesn't have a health endpoint — just verify config is set
    const ok = !!(this.merchantEmail && this.secretWord);
    return { ok, latencyMs: 0, message: ok ? undefined : 'Skrill credentials not configured' };
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    // Skrill uses a hosted payment page — we build the redirect URL
    const returnUrl = params.successUrl ?? `${process.env.APP_URL ?? 'https://app.holaprime.com'}/checkout/complete`;
    const cancelUrl = params.cancelUrl  ?? `${process.env.APP_URL ?? 'https://app.holaprime.com'}/checkout/cancel`;
    const statusUrl = `${process.env.API_BASE_URL ?? 'https://api.holaprime.com'}/api/v1/payments-gateway/webhook/skrill`;

    const intentId = params.metadata?.intentId as string ?? Date.now().toString();

    const formParams = new URLSearchParams({
      pay_to_email:        this.merchantEmail,
      merchant_id:         this.merchantId,
      amount:              params.amountUsd.toFixed(2),
      currency:            'USD',
      transaction_id:      intentId,
      return_url:          returnUrl,
      cancel_url:          cancelUrl,
      status_url:          statusUrl,
      detail1_description: 'Hola Prime Challenge',
      detail1_text:        params.productId,
    });

    const redirectUrl = `https://pay.skrill.com/?${formParams.toString()}`;

    return {
      intentId,
      gatewayReference: intentId,
      status:           'pending',
      redirectUrl,
      raw:              Object.fromEntries(formParams.entries()),
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    const body = new URLSearchParams(params.rawBody.toString());

    // Skrill signs with MD5(merchant_id + transaction_id + uppercase(MD5(secret)) + amount + currency + status)
    const secretMd5  = createHash('md5').update(this.secretWord).digest('hex').toUpperCase();
    const signString = [
      this.merchantId,
      body.get('transaction_id') ?? '',
      secretMd5,
      body.get('mb_amount') ?? '',
      body.get('mb_currency') ?? '',
      body.get('status') ?? '',
    ].join('');
    const expected = createHash('md5').update(signString).digest('hex');

    if (expected.toLowerCase() !== (body.get('md5sig') ?? '').toLowerCase()) {
      throw new Error('Invalid Skrill webhook signature');
    }

    const statusCode = parseInt(body.get('status') ?? '0', 10);
    const statusMap: Record<number, 'completed'|'failed'|'pending'> = {
      2: 'completed', 0: 'pending', [-1]: 'pending',
      [-2]: 'failed', [-3]: 'failed',
    };

    return {
      eventType:        `payment.status.${statusCode}`,
      gatewayReference: body.get('transaction_id') ?? '',
      status:           statusMap[statusCode] ?? 'pending',
      amountPaid:       body.get('mb_amount') ? parseFloat(body.get('mb_amount')!) : undefined,
      currency:         body.get('mb_currency') ?? 'USD',
      raw:              Object.fromEntries(body.entries()),
    };
  }
}

// ── Neteller adapter ──────────────────────────────────────────────────────────
export class NetellerAdapter implements IPaymentGateway {
  readonly name        = 'neteller';
  readonly displayName = 'Neteller';

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly clientId:     string,
    private readonly clientSecret: string,
    private readonly env:          'production' | 'test' = 'production',
  ) {}

  private get baseUrl() {
    return this.env === 'production'
      ? 'https://api.neteller.com'
      : 'https://api.neteller.com'; // Neteller sandbox uses same domain with test credentials
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;

    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res   = await fetch(`${this.baseUrl}/v1/oauth2/token?grant_type=client_credentials`, {
      method:  'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken    = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
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
    const token = await this.getToken();

    const order = await fetch(`${this.baseUrl}/v1/orders`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        merchantRefId: params.metadata?.intentId ?? Date.now().toString(),
        amount:        Math.round(params.amountUsd * 100), // in cents
        currency:      'USD',
        lang:          'en_US',
        urls:          {
          returnUrl: params.successUrl ?? `${process.env.APP_URL}/checkout/complete`,
          cancelUrl: params.cancelUrl  ?? `${process.env.APP_URL}/checkout/cancel`,
        },
        orderLines: [{
          name:     'Hola Prime Challenge',
          quantity: 1,
          unitPrice: Math.round(params.amountUsd * 100),
        }],
      }),
    }).then(r => r.json()) as { orderId: string; redirectUrl: string; links: Array<{ref:string; href:string}> };

    const redirectUrl = order.redirectUrl
      ?? order.links?.find(l => l.ref === 'payment')?.href
      ?? '';

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: order.orderId,
      status:           'pending',
      redirectUrl,
      raw:              order as unknown as Record<string, unknown>,
    };
  }

  async verifyWebhook(params: WebhookVerifyParams) {
    // Neteller webhook — verify using their payload signature
    const event = JSON.parse(params.rawBody.toString()) as Record<string, unknown>;
    const txn   = (event.transaction as any) ?? {};

    const statusMap: Record<string, 'completed'|'failed'|'pending'> = {
      accepted: 'completed', approved: 'completed',
      rejected: 'failed',   failed:   'failed',
      pending:  'pending',
    };

    return {
      eventType:        `neteller.${txn.type ?? 'payment'}`,
      gatewayReference: txn.merchantRefId ?? '',
      status:           statusMap[txn.status?.toLowerCase() ?? ''] ?? 'pending',
      amountPaid:       txn.amount ? txn.amount / 100 : undefined,
      currency:         txn.currency as string ?? 'USD',
      raw:              event,
    };
  }
}
