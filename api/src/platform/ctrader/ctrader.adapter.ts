import type {
  IPlatformAdapter, PlatformType, CreateAccountParams,
  PlatformAccount, AccountBalance, TradeHistory, Trade, HealthStatus,
} from '../adapter.interface.js';
import { config } from '../../config/index.js';

// cTrader Open API (protobuf-based or REST wrapper)
// Docs: https://help.ctrader.com/open-api/
const BASE_URL = config.platforms.ctrader.env === 'live'
  ? 'https://api.ctrader.com'
  : 'https://demo.ctrader.com';

export class CTraderAdapter implements IPlatformAdapter {
  readonly platform: PlatformType = 'ctrader';
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private async getToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const res = await fetch(`${BASE_URL}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     config.platforms.ctrader.clientId,
        client_secret: config.platforms.ctrader.clientSecret,
      }),
    });

    if (!res.ok) throw new Error(`cTrader auth failed: ${res.status}`);
    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000 - 30000);
    return this.accessToken;
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`cTrader API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.getToken();
      return { connected: true, latencyMs: Date.now() - start, serverTime: new Date() };
    } catch (err) {
      return { connected: false, latencyMs: null, serverTime: null, message: String(err) };
    }
  }

  async createAccount(params: CreateAccountParams): Promise<PlatformAccount> {
    const password = params.password ?? this.generatePassword();

    const data = await this.request<{
      login: number; hashedPassword: string; balance: number; currency: string; leverage: number;
    }>(`/v2/brokers/${config.platforms.ctrader.accountId}/traders`, 'POST', {
      name:          params.name,
      email:         params.email,
      balance:       Math.round(params.balance * 100),  // cTrader uses cents
      depositCurrency: params.currency,
      leverageInCents: params.leverage * 100,
      groupName:     params.group ?? 'default',
      hashedPassword: password,
    });

    return {
      platformLogin:    String(data.login),
      platformServer:   BASE_URL,
      mainPassword:     password,
      readonlyPassword: '',
      balance:          data.balance / 100,
      equity:           data.balance / 100,
      currency:         data.currency,
      leverage:         data.leverage / 100,
      group:            params.group ?? 'default',
      isActive:         true,
      createdAt:        new Date(),
    };
  }

  async getAccount(login: string): Promise<PlatformAccount | null> {
    try {
      const data = await this.request<{
        login: number; balance: number; equity: number;
        depositCurrency: string; leverageInCents: number; groupName: string;
        status: string; registrationTimestamp: number;
      }>(`/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}`);

      return {
        platformLogin:    String(data.login),
        platformServer:   BASE_URL,
        mainPassword:     '',
        readonlyPassword: '',
        balance:          data.balance / 100,
        equity:           data.equity / 100,
        currency:         data.depositCurrency,
        leverage:         data.leverageInCents / 100,
        group:            data.groupName,
        isActive:         data.status === 'ENABLED',
        createdAt:        new Date(data.registrationTimestamp),
      };
    } catch {
      return null;
    }
  }

  async getBalance(login: string): Promise<AccountBalance> {
    const data = await this.request<{
      balance: number; equity: number; margin: number;
      freeMargin: number; unrealizedPnL: number; depositCurrency: string;
    }>(`/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}/balance`);

    return {
      login,
      balance:     data.balance / 100,
      equity:      data.equity / 100,
      margin:      data.margin / 100,
      freeMargin:  data.freeMargin / 100,
      marginLevel: data.equity > 0 && data.margin > 0 ? data.equity / data.margin * 100 : null,
      floatingPL:  data.unrealizedPnL / 100,
      currency:    data.depositCurrency,
      updatedAt:   new Date(),
    };
  }

  async getTradeHistory(login: string, from: Date, to: Date): Promise<TradeHistory> {
    const data = await this.request<{
      deal: Array<{
        dealId: number; symbolName: string; tradeSide: string; volume: number;
        executionPrice: number; closePrice: number; stopLoss: number; takeProfit: number;
        commission: number; swap: number; grossProfit: number;
        executionTimestamp: number; closeTimestamp: number;
      }>;
    }>(`/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}/deals?from=${from.getTime()}&to=${to.getTime()}`);

    const trades: Trade[] = data.deal.map((d) => ({
      ticket:     String(d.dealId),
      symbol:     d.symbolName,
      direction:  d.tradeSide === 'BUY' ? 'buy' : 'sell',
      lots:       d.volume / 100000,
      openPrice:  d.executionPrice,
      closePrice: d.closePrice || null,
      sl:         d.stopLoss || null,
      tp:         d.takeProfit || null,
      commission: d.commission / 100,
      swap:       d.swap / 100,
      profit:     d.grossProfit / 100,
      openTime:   new Date(d.executionTimestamp),
      closeTime:  d.closeTimestamp ? new Date(d.closeTimestamp) : null,
      isOpen:     !d.closeTimestamp,
    }));

    const totalProfit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
    const closed = trades.filter((t) => !t.isOpen);
    const winners = closed.filter((t) => (t.profit ?? 0) > 0);

    return {
      trades,
      totalProfit,
      totalTrades: trades.length,
      winRate:     closed.length > 0 ? winners.length / closed.length : null,
      fromDate:    from,
      toDate:      to,
    };
  }

  async getOpenTrades(login: string): Promise<Trade[]> {
    const data = await this.request<{
      position: Array<{
        positionId: number; symbolName: string; tradeSide: string; volume: number;
        price: number; stopLoss: number; takeProfit: number;
        commission: number; swap: number; unrealizedPnL: number;
        openTimestamp: number;
      }>;
    }>(`/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}/positions`);

    return data.position.map((p) => ({
      ticket:     String(p.positionId),
      symbol:     p.symbolName,
      direction:  p.tradeSide === 'BUY' ? 'buy' : 'sell',
      lots:       p.volume / 100000,
      openPrice:  p.price,
      closePrice: null,
      sl:         p.stopLoss || null,
      tp:         p.takeProfit || null,
      commission: p.commission / 100,
      swap:       p.swap / 100,
      profit:     p.unrealizedPnL / 100,
      openTime:   new Date(p.openTimestamp),
      closeTime:  null,
      isOpen:     true,
    }));
  }

  async changePassword(login: string, newPassword: string): Promise<void> {
    await this.request(
      `/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}/password`,
      'PUT',
      { hashedPassword: newPassword },
    );
  }

  async setTradingEnabled(login: string, enabled: boolean): Promise<void> {
    await this.request(
      `/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}`,
      'PATCH',
      { status: enabled ? 'ENABLED' : 'DISABLED' },
    );
  }

  async setLeverage(login: string, leverage: number): Promise<void> {
    await this.request(
      `/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}`,
      'PATCH',
      { leverageInCents: leverage * 100 },
    );
  }

  async adjustBalance(login: string, amount: number, comment: string): Promise<void> {
    await this.request(
      `/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}/deposit`,
      'POST',
      { amountInCents: Math.round(amount * 100), comment },
    );
  }

  async deleteAccount(login: string): Promise<void> {
    await this.request(
      `/v2/brokers/${config.platforms.ctrader.accountId}/traders/${login}`,
      'PATCH',
      { status: 'ARCHIVED' },
    );
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
