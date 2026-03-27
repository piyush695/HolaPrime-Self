import type {
  IPlatformAdapter, PlatformType, CreateAccountParams,
  PlatformAccount, AccountBalance, TradeHistory, Trade,
  HealthStatus,
} from '../adapter.interface.js';
import { config } from '../../config/index.js';

// MT5 uses a REST bridge (common bridges: MetaTrader Manager API / QuotesFeed / custom)
// Docs: https://www.mql5.com/en/docs/integration/managerapi
export class MT5Adapter implements IPlatformAdapter {
  readonly platform: PlatformType = 'mt5';
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly server: string;

  constructor(apiUrl?: string, apiKey?: string, server?: string) {
    this.apiUrl  = apiUrl  || config.platforms.mt5.apiUrl;
    this.apiKey  = apiKey  || config.platforms.mt5.apiKey;
    this.server  = server  || config.platforms.mt5.server;
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MT5 API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const data = await this.request<{ time: string }>('/health');
      return {
        connected:  true,
        latencyMs:  Date.now() - start,
        serverTime: new Date(data.time),
      };
    } catch (err) {
      return { connected: false, latencyMs: null, serverTime: null, message: String(err) };
    }
  }

  async createAccount(params: CreateAccountParams): Promise<PlatformAccount> {
    const password = params.password ?? this.generatePassword();
    const readonlyPw = params.readonlyPw ?? this.generatePassword();

    const data = await this.request<{
      login: string; group: string; leverage: number;
    }>('/accounts', 'POST', {
      Name:           params.name,
      Email:          params.email,
      Balance:        params.balance,
      Currency:       params.currency,
      Leverage:       params.leverage,
      Group:          params.group ?? 'prop_challenge',
      Password:       password,
      PasswordInvestor: readonlyPw,
    });

    return {
      platformLogin:    data.login,
      platformServer:   this.server,
      mainPassword:     password,
      readonlyPassword: readonlyPw,
      balance:          params.balance,
      equity:           params.balance,
      currency:         params.currency,
      leverage:         data.leverage,
      group:            data.group,
      isActive:         true,
      createdAt:        new Date(),
    };
  }

  async getAccount(login: string): Promise<PlatformAccount | null> {
    try {
      const data = await this.request<{
        login: string; balance: number; equity: number;
        currency: string; leverage: number; group: string;
        enable: boolean; registration: string;
      }>(`/accounts/${login}`);

      return {
        platformLogin:    data.login,
        platformServer:   this.server,
        mainPassword:     '',
        readonlyPassword: '',
        balance:          data.balance,
        equity:           data.equity,
        currency:         data.currency,
        leverage:         data.leverage,
        group:            data.group,
        isActive:         data.enable,
        createdAt:        new Date(data.registration),
      };
    } catch {
      return null;
    }
  }

  async getBalance(login: string): Promise<AccountBalance> {
    const data = await this.request<{
      balance: number; equity: number; margin: number;
      margin_free: number; margin_level: number; floating_pl: number;
      currency: string;
    }>(`/accounts/${login}/balance`);

    return {
      login,
      balance:     data.balance,
      equity:      data.equity,
      margin:      data.margin,
      freeMargin:  data.margin_free,
      marginLevel: data.margin_level,
      floatingPL:  data.floating_pl,
      currency:    data.currency,
      updatedAt:   new Date(),
    };
  }

  async getTradeHistory(login: string, from: Date, to: Date): Promise<TradeHistory> {
    const data = await this.request<{
      deals: Array<{
        ticket: string; symbol: string; type: number; volume: number;
        price_open: number; price_close: number; sl: number; tp: number;
        commission: number; swap: number; profit: number;
        time_open: number; time_close: number;
      }>;
    }>(`/accounts/${login}/history?from=${from.toISOString()}&to=${to.toISOString()}`);

    const trades: Trade[] = data.deals.map((d) => ({
      ticket:     d.ticket,
      symbol:     d.symbol,
      direction:  d.type === 0 ? 'buy' : 'sell',
      lots:       d.volume / 100,
      openPrice:  d.price_open,
      closePrice: d.price_close || null,
      sl:         d.sl || null,
      tp:         d.tp || null,
      commission: d.commission,
      swap:       d.swap,
      profit:     d.profit,
      openTime:   new Date(d.time_open * 1000),
      closeTime:  d.time_close ? new Date(d.time_close * 1000) : null,
      isOpen:     !d.time_close,
    }));

    const totalProfit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
    const closedTrades = trades.filter((t) => !t.isOpen);
    const winners = closedTrades.filter((t) => (t.profit ?? 0) > 0);

    return {
      trades,
      totalProfit,
      totalTrades: trades.length,
      winRate:     closedTrades.length > 0 ? winners.length / closedTrades.length : null,
      fromDate:    from,
      toDate:      to,
    };
  }

  async getOpenTrades(login: string): Promise<Trade[]> {
    const data = await this.request<{
      positions: Array<{
        ticket: string; symbol: string; type: number; volume: number;
        price_open: number; sl: number; tp: number;
        commission: number; swap: number; profit: number;
        time_open: number;
      }>;
    }>(`/accounts/${login}/positions`);

    return data.positions.map((p) => ({
      ticket:     p.ticket,
      symbol:     p.symbol,
      direction:  p.type === 0 ? 'buy' : 'sell',
      lots:       p.volume / 100,
      openPrice:  p.price_open,
      closePrice: null,
      sl:         p.sl || null,
      tp:         p.tp || null,
      commission: p.commission,
      swap:       p.swap,
      profit:     p.profit,
      openTime:   new Date(p.time_open * 1000),
      closeTime:  null,
      isOpen:     true,
    }));
  }

  async changePassword(login: string, newPassword: string, type: 'main' | 'readonly' = 'main'): Promise<void> {
    await this.request(`/accounts/${login}/password`, 'PUT', {
      password:  newPassword,
      type:      type === 'readonly' ? 'investor' : 'main',
    });
  }

  async setTradingEnabled(login: string, enabled: boolean): Promise<void> {
    await this.request(`/accounts/${login}`, 'PATCH', { enable: enabled });
  }

  async setLeverage(login: string, leverage: number): Promise<void> {
    await this.request(`/accounts/${login}`, 'PATCH', { leverage });
  }

  async adjustBalance(login: string, amount: number, comment: string): Promise<void> {
    await this.request(`/accounts/${login}/balance`, 'POST', {
      amount,
      comment,
      type: amount >= 0 ? 'balance' : 'credit',
    });
  }

  async deleteAccount(login: string): Promise<void> {
    await this.request(`/accounts/${login}`, 'DELETE');
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
