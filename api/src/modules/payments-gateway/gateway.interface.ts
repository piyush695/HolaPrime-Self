// ── Payment Gateway Adapter Interface ────────────────────────────────────────
// Same pattern as IPlatformAdapter — every gateway implements this.
// The rest of the system only ever calls these methods; gateway-specific
// logic stays fully encapsulated in each adapter.

export interface CreateIntentParams {
  userId:       string;
  productId:    string;
  amount:       number;
  currency:     string;
  amountUsd:    number;
  successUrl?:  string;
  cancelUrl?:   string;
  metadata?:    Record<string, unknown>;
}

export interface IntentResult {
  intentId:          string;         // our internal payment_intents.id
  gatewayReference:  string;         // gateway's own ID
  status:            'pending' | 'processing' | 'completed' | 'failed';
  // For redirect-based gateways (Stripe, Flutterwave, Razorpay)
  redirectUrl?:      string;
  // For crypto gateways
  walletAddress?:    string;
  coin?:             string;
  network?:          string;
  expectedAmount?:   number;
  expiresAt?:        Date;
  // For manual gateways (bank transfer)
  instructions?:     Record<string, unknown>;
  // Raw gateway payload
  raw?:              Record<string, unknown>;
}

export interface WebhookVerifyParams {
  headers:  Record<string, string>;
  rawBody:  string | Buffer;
  secret:   string;
}

export interface IPaymentGateway {
  readonly name: string;
  readonly displayName: string;

  /** Check gateway credentials are valid and gateway is reachable */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; message?: string }>;

  /** Create a payment intent and return redirect URL / wallet address / instructions */
  createIntent(params: CreateIntentParams): Promise<IntentResult>;

  /** Verify a webhook signature and return the parsed event */
  verifyWebhook(params: WebhookVerifyParams): Promise<{
    eventType: string;
    gatewayReference: string;
    status: 'completed' | 'failed' | 'pending';
    amountPaid?: number;
    currency?: string;
    raw: Record<string, unknown>;
  }>;

  /** Poll for payment status (used by gateways without reliable webhooks) */
  checkStatus?(gatewayReference: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    amountPaid?: number;
  }>;

  /** Issue a refund */
  refund?(gatewayReference: string, amount: number, reason?: string): Promise<{ refundId: string }>;
}
