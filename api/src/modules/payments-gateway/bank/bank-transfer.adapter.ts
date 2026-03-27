import { randomBytes } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

export interface BankDetails {
  currency:       string;
  bankName:       string;
  accountName:    string;
  accountNumber?: string;
  iban?:          string;
  swift?:         string;
  routingNumber?: string;
  sortCode?:      string;
  ifsc?:          string;       // India
  note?:          string;
}

export interface BankTransferConfig {
  banks: BankDetails[];
}

function generateRef(): string {
  // Easy to read reference code: HP-XXXX-XXXX
  const part = randomBytes(4).toString('hex').toUpperCase();
  return `HP-${part.slice(0,4)}-${part.slice(4)}`;
}

export class BankTransferAdapter implements IPaymentGateway {
  readonly name        = 'bank_transfer';
  readonly displayName = 'Bank Transfer / Wire';

  constructor(private readonly config: BankTransferConfig) {}

  async healthCheck() {
    const ok = this.config.banks.length > 0;
    return { ok, latencyMs: 0, message: ok ? undefined : 'No bank accounts configured' };
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const refCode  = generateRef();
    const currency = params.currency || 'USD';

    // Pick bank account for the requested currency (fallback to first USD account)
    const bank = this.config.banks.find(b => b.currency === currency)
              ?? this.config.banks.find(b => b.currency === 'USD')
              ?? this.config.banks[0];

    if (!bank) throw new Error('No bank accounts configured for this currency');

    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: refCode,
      status:           'pending',
      instructions: {
        referenceCode: refCode,
        amount:        params.amount,
        currency,
        bank,
        importantNote: `You MUST include reference code ${refCode} in the transfer memo/description.
          Transfers without the reference code cannot be matched and will be delayed.
          Processing time: 1-3 business days after receipt.`,
      },
      raw: { refCode, bank, amount: params.amount, currency },
    };
  }

  // Bank transfers don't have webhooks — admin confirms via admin panel
  async verifyWebhook(_params: WebhookVerifyParams) {
    throw new Error('Bank transfers do not support webhooks — admin must confirm manually');
  }
}
