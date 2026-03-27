import { randomBytes } from 'crypto';
import type { IPaymentGateway, CreateIntentParams, IntentResult, WebhookVerifyParams } from '../gateway.interface.js';

// Wallet configuration per coin/network - set in DB config field
export interface ManualCryptoConfig {
  wallets: Array<{
    coin:    string;   // USDT, BTC, ETH, BNB
    network: string;   // TRC-20, ERC-20, BEP-20, Bitcoin, Ethereum
    address: string;   // your receiving wallet address
    label?:  string;
  }>;
  defaultCoin:    string;
  defaultNetwork: string;
}

export class ManualCryptoAdapter implements IPaymentGateway {
  readonly name        = 'crypto_manual';
  readonly displayName = 'Crypto (Manual)';

  constructor(private readonly config: ManualCryptoConfig) {}

  async healthCheck() {
    const ok = this.config.wallets.length > 0;
    return { ok, latencyMs: 0, message: ok ? undefined : 'No wallets configured' };
  }

  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const wallet = this.config.wallets.find(
      w => w.coin === this.config.defaultCoin && w.network === this.config.defaultNetwork,
    ) ?? this.config.wallets[0];

    if (!wallet) throw new Error('No crypto wallets configured');

    // For manual crypto, we just return the wallet address.
    // Admin confirms receipt in the admin panel.
    return {
      intentId:         params.metadata?.intentId as string ?? '',
      gatewayReference: `manual_${randomBytes(8).toString('hex')}`,
      status:           'pending',
      walletAddress:    wallet.address,
      coin:             wallet.coin,
      network:          wallet.network,
      expectedAmount:   params.amountUsd, // assumes stablecoin; for BTC/ETH we'd need price lookup
      expiresAt:        new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      instructions: {
        wallets:   this.config.wallets,
        important: 'Send exact amount. Include your order ID in the memo if supported.',
      },
      raw: { wallets: this.config.wallets },
    };
  }

  // Manual crypto doesn't have real webhooks — admin confirms via admin panel
  async verifyWebhook(_params: WebhookVerifyParams) {
    throw new Error('Manual crypto does not support webhooks — use admin confirmation');
  }
}
