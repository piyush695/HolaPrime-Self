// MatchTrader Adapter
// Docs: https://docs.matchtrader.com/

import type {
  IPlatformAdapter, PlatformType, CreateAccountParams,
  PlatformAccount, AccountBalance, TradeHistory, Trade, HealthStatus,
} from '../adapter.interface.js';
import { config } from '../../config/index.js';

export class MatchTraderAdapter implements IPlatformAdapter {
  readonly platform: PlatformType = 'matchtrader';

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await fetch(`${config.platforms.matchtrader.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.platforms.matchtrader.apiKey,
        'X-BROKER-ID': config.platforms.matchtrader.brokerId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`MatchTrader ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.request('/v1/health');
      return { connected: true, latencyMs: Date.now() - start, serverTime: new Date() };
    } catch (err) {
      return { connected: false, latencyMs: null, serverTime: null, message: String(err) };
    }
  }

  async createAccount(params: CreateAccountParams): Promise<PlatformAccount> {
    const password = params.password ?? this.generatePassword();
    const data = await this.request<{ login: string; leverage: number }>('/v1/accounts', 'POST', {
      name:      params.name,
      email:     params.email,
      balance:   params.balance,
      currency:  params.currency,
      leverage:  params.leverage,
      password,
      group:     params.group ?? 'PROP_CHALLENGE',
    });
    return {
      platformLogin: data.login, platformServer: config.platforms.matchtrader.apiUrl,
      mainPassword: password, readonlyPassword: '',
      balance: params.balance, equity: params.balance,
      currency: params.currency, leverage: data.leverage,
      group: params.group ?? 'PROP_CHALLENGE', isActive: true, createdAt: new Date(),
    };
  }

  async getAccount(login: string): Promise<PlatformAccount | null> {
    try {
      const d = await this.request<any>(`/v1/accounts/${login}`);
      return {
        platformLogin: d.login, platformServer: config.platforms.matchtrader.apiUrl,
        mainPassword: '', readonlyPassword: '',
        balance: d.balance, equity: d.equity, currency: d.currency,
        leverage: d.leverage, group: d.group, isActive: d.isEnabled,
        createdAt: new Date(d.createdAt),
      };
    } catch { return null; }
  }

  async getBalance(login: string): Promise<AccountBalance> {
    const d = await this.request<any>(`/v1/accounts/${login}/balance`);
    return {
      login, balance: d.balance, equity: d.equity, margin: d.margin,
      freeMargin: d.freeMargin, marginLevel: d.marginLevel,
      floatingPL: d.floatingPL, currency: d.currency, updatedAt: new Date(),
    };
  }

  async getTradeHistory(login: string, from: Date, to: Date): Promise<TradeHistory> {
    const d = await this.request<{ orders: any[] }>(`/v1/accounts/${login}/history?from=${from.toISOString()}&to=${to.toISOString()}`);
    const trades: Trade[] = d.orders.map((o) => ({
      ticket: o.id, symbol: o.symbol, direction: o.side.toLowerCase(),
      lots: o.volume, openPrice: o.openPrice, closePrice: o.closePrice ?? null,
      sl: o.sl ?? null, tp: o.tp ?? null, commission: o.commission ?? 0,
      swap: o.swap ?? 0, profit: o.profit ?? null,
      openTime: new Date(o.openTime), closeTime: o.closeTime ? new Date(o.closeTime) : null,
      isOpen: !o.closeTime,
    }));
    const totalProfit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
    const closed = trades.filter((t) => !t.isOpen);
    return { trades, totalProfit, totalTrades: trades.length, winRate: closed.length > 0 ? closed.filter((t) => (t.profit ?? 0) > 0).length / closed.length : null, fromDate: from, toDate: to };
  }

  async getOpenTrades(login: string): Promise<Trade[]> {
    const d = await this.request<{ positions: any[] }>(`/v1/accounts/${login}/positions`);
    return d.positions.map((p) => ({
      ticket: p.id, symbol: p.symbol, direction: p.side.toLowerCase(),
      lots: p.volume, openPrice: p.openPrice, closePrice: null,
      sl: p.sl ?? null, tp: p.tp ?? null, commission: p.commission ?? 0,
      swap: p.swap ?? 0, profit: p.unrealizedPL ?? null,
      openTime: new Date(p.openTime), closeTime: null, isOpen: true,
    }));
  }

  async changePassword(login: string, newPassword: string): Promise<void> {
    await this.request(`/v1/accounts/${login}/password`, 'PUT', { password: newPassword });
  }

  async setTradingEnabled(login: string, enabled: boolean): Promise<void> {
    await this.request(`/v1/accounts/${login}`, 'PATCH', { isEnabled: enabled });
  }

  async setLeverage(login: string, leverage: number): Promise<void> {
    await this.request(`/v1/accounts/${login}`, 'PATCH', { leverage });
  }

  async adjustBalance(login: string, amount: number, comment: string): Promise<void> {
    await this.request(`/v1/accounts/${login}/balance`, 'POST', { amount, comment });
  }

  async deleteAccount(login: string): Promise<void> {
    await this.request(`/v1/accounts/${login}`, 'DELETE');
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
