// =============================================================================
// NinjaTrader Adapter
// Docs: https://ninjatrader.com/support/helpGuides/nt8/
// NinjaTrader uses a TCP/named-pipe connection for live and an HTTP REST API
// for the broker integration layer. This adapter targets the REST broker API.
// =============================================================================

import type {
  IPlatformAdapter, PlatformType, CreateAccountParams,
  PlatformAccount, AccountBalance, TradeHistory, Trade, HealthStatus,
} from '../adapter.interface.js';
import { config } from '../../config/index.js';

export class NinjaTraderAdapter implements IPlatformAdapter {
  readonly platform: PlatformType = 'ninjatrader';

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await fetch(`${config.platforms.ninjatrader.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.platforms.ninjatrader.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`NinjaTrader ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.request('/api/v1/status');
      return { connected: true, latencyMs: Date.now() - start, serverTime: new Date() };
    } catch (err) {
      return { connected: false, latencyMs: null, serverTime: null, message: String(err) };
    }
  }

  async createAccount(params: CreateAccountParams): Promise<PlatformAccount> {
    const password = params.password ?? this.generatePassword();
    const data = await this.request<{ accountId: string }>('/api/v1/accounts', 'POST', {
      name: params.name, email: params.email,
      initialBalance: params.balance, currency: params.currency,
      leverage: params.leverage, password, accountType: params.group ?? 'SIM',
    });
    return {
      platformLogin: data.accountId, platformServer: config.platforms.ninjatrader.apiUrl,
      mainPassword: password, readonlyPassword: '',
      balance: params.balance, equity: params.balance,
      currency: params.currency, leverage: params.leverage,
      group: params.group ?? 'SIM', isActive: true, createdAt: new Date(),
    };
  }

  async getAccount(login: string): Promise<PlatformAccount | null> {
    try {
      const d = await this.request<any>(`/api/v1/accounts/${login}`);
      return {
        platformLogin: d.accountId, platformServer: config.platforms.ninjatrader.apiUrl,
        mainPassword: '', readonlyPassword: '',
        balance: d.cashValue, equity: d.cashValue + d.unrealizedPnL,
        currency: d.currency, leverage: d.leverage,
        group: d.accountType, isActive: d.status === 'Active',
        createdAt: new Date(d.createdAt),
      };
    } catch { return null; }
  }

  async getBalance(login: string): Promise<AccountBalance> {
    const d = await this.request<any>(`/api/v1/accounts/${login}/balance`);
    return {
      login, balance: d.cashValue, equity: d.cashValue + d.unrealizedPnL,
      margin: d.buyingPower, freeMargin: d.excessInitMargin,
      marginLevel: null, floatingPL: d.unrealizedPnL,
      currency: d.currency, updatedAt: new Date(),
    };
  }

  async getTradeHistory(login: string, from: Date, to: Date): Promise<TradeHistory> {
    const d = await this.request<{ executions: any[] }>(
      `/api/v1/accounts/${login}/executions?start=${from.toISOString()}&end=${to.toISOString()}`,
    );
    const trades: Trade[] = d.executions.map((e) => ({
      ticket: e.executionId, symbol: e.instrument, direction: e.orderAction === 'BUY' ? 'buy' : 'sell',
      lots: e.quantity, openPrice: e.averagePrice, closePrice: null,
      sl: null, tp: null, commission: e.commission ?? 0, swap: 0,
      profit: e.realizedPnL ?? null, openTime: new Date(e.time), closeTime: null, isOpen: false,
    }));
    const totalProfit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
    return { trades, totalProfit, totalTrades: trades.length, winRate: null, fromDate: from, toDate: to };
  }

  async getOpenTrades(login: string): Promise<Trade[]> {
    const d = await this.request<{ positions: any[] }>(`/api/v1/accounts/${login}/positions`);
    return d.positions.map((p) => ({
      ticket: p.positionId, symbol: p.instrument,
      direction: p.marketPosition === 'Long' ? 'buy' : 'sell',
      lots: p.quantity, openPrice: p.averagePrice, closePrice: null,
      sl: null, tp: null, commission: 0, swap: 0, profit: p.unrealizedPnL,
      openTime: new Date(p.openTime), closeTime: null, isOpen: true,
    }));
  }

  async changePassword(login: string, newPassword: string): Promise<void> {
    await this.request(`/api/v1/accounts/${login}/password`, 'PUT', { password: newPassword });
  }

  async setTradingEnabled(login: string, enabled: boolean): Promise<void> {
    await this.request(`/api/v1/accounts/${login}/status`, 'PUT', { status: enabled ? 'Active' : 'Disabled' });
  }

  async setLeverage(login: string, leverage: number): Promise<void> {
    await this.request(`/api/v1/accounts/${login}`, 'PATCH', { leverage });
  }

  async adjustBalance(login: string, amount: number, comment: string): Promise<void> {
    await this.request(`/api/v1/accounts/${login}/funding`, 'POST', { amount, note: comment });
  }

  async deleteAccount(login: string): Promise<void> {
    await this.request(`/api/v1/accounts/${login}`, 'DELETE');
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

// =============================================================================
// Tradovate Adapter
// Docs: https://api.tradovate.com/v1/docs/
// Tradovate is primarily a US futures platform with a modern REST API
// =============================================================================

export class TradovateAdapter implements IPlatformAdapter {
  readonly platform: PlatformType = 'tradovate';
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private mdAccessToken: string | null = null;

  private get apiUrl(): string { return config.platforms.tradovate.apiUrl; }

  private async authenticate(): Promise<void> {
    const res = await fetch(`${this.apiUrl}/auth/accesstokenrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:       config.platforms.tradovate.username,
        password:   config.platforms.tradovate.password,
        appId:      config.platforms.tradovate.appId,
        appVersion: config.platforms.tradovate.appVersion,
        cid:        0,
        sec:        '',
      }),
    });
    if (!res.ok) throw new Error(`Tradovate auth failed: ${res.status}`);
    const d = await res.json() as { accessToken: string; expirationTime: string; mdAccessToken: string };
    this.accessToken   = d.accessToken;
    this.tokenExpiry   = new Date(d.expirationTime);
    this.mdAccessToken = d.mdAccessToken;
  }

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry <= new Date()) {
      await this.authenticate();
    }
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Tradovate ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.authenticate();
      return { connected: true, latencyMs: Date.now() - start, serverTime: new Date() };
    } catch (err) {
      return { connected: false, latencyMs: null, serverTime: null, message: String(err) };
    }
  }

  async createAccount(params: CreateAccountParams): Promise<PlatformAccount> {
    // Tradovate accounts are created through broker back-office API
    const data = await this.request<{ id: number; name: string }>('/account/openaccount', 'POST', {
      name:     params.name,
      email:    params.email,
      balance:  params.balance,
      currency: params.currency,
    });
    return {
      platformLogin:    String(data.id),
      platformServer:   this.apiUrl,
      mainPassword:     params.password ?? '',
      readonlyPassword: '',
      balance:          params.balance,
      equity:           params.balance,
      currency:         params.currency,
      leverage:         params.leverage,
      group:            params.group ?? 'prop',
      isActive:         true,
      createdAt:        new Date(),
    };
  }

  async getAccount(login: string): Promise<PlatformAccount | null> {
    try {
      const d = await this.request<any>(`/account/item?id=${login}`);
      const balance = await this.request<any>(`/cashBalance/getcashbalancesnapshot?accountId=${login}`);
      return {
        platformLogin: String(d.id), platformServer: this.apiUrl,
        mainPassword: '', readonlyPassword: '',
        balance: balance?.totalCashValue ?? 0,
        equity: (balance?.totalCashValue ?? 0) + (balance?.openPnL ?? 0),
        currency: 'USD', leverage: 1,
        group: d.accountType ?? 'prop',
        isActive: d.active ?? true,
        createdAt: new Date(d.timestamp),
      };
    } catch { return null; }
  }

  async getBalance(login: string): Promise<AccountBalance> {
    const d = await this.request<any>(`/cashBalance/getcashbalancesnapshot?accountId=${login}`);
    return {
      login, balance: d.totalCashValue, equity: d.totalCashValue + d.openPnL,
      margin: d.initialMargin, freeMargin: d.availableFunds,
      marginLevel: null, floatingPL: d.openPnL, currency: 'USD', updatedAt: new Date(),
    };
  }

  async getTradeHistory(login: string, from: Date, to: Date): Promise<TradeHistory> {
    const d = await this.request<{ fills: any[] }>(
      `/fill/list?accountId=${login}&startTimestamp=${from.toISOString()}&endTimestamp=${to.toISOString()}`,
    );
    const trades: Trade[] = (d.fills ?? []).map((f) => ({
      ticket: String(f.id), symbol: f.contractId,
      direction: f.action === 'Buy' ? 'buy' : 'sell',
      lots: f.qty, openPrice: f.price, closePrice: null,
      sl: null, tp: null, commission: f.commission ?? 0, swap: 0,
      profit: null, openTime: new Date(f.timestamp), closeTime: null, isOpen: false,
    }));
    return { trades, totalProfit: 0, totalTrades: trades.length, winRate: null, fromDate: from, toDate: to };
  }

  async getOpenTrades(login: string): Promise<Trade[]> {
    const d = await this.request<{ positions: any[] }>(`/position/list?accountId=${login}`);
    return (d.positions ?? []).map((p) => ({
      ticket: String(p.id), symbol: p.contractId,
      direction: p.netPos > 0 ? 'buy' : 'sell',
      lots: Math.abs(p.netPos), openPrice: p.netPrice, closePrice: null,
      sl: null, tp: null, commission: 0, swap: 0, profit: p.openPnL,
      openTime: new Date(), closeTime: null, isOpen: true,
    }));
  }

  async changePassword(_login: string, _newPassword: string): Promise<void> {
    // Tradovate password changes go through user account management, not trading API
    throw new Error('Password changes for Tradovate must be done through the user portal.');
  }

  async setTradingEnabled(login: string, enabled: boolean): Promise<void> {
    await this.request(`/account/enabletrading`, 'POST', { accountId: parseInt(login, 10), enabled });
  }

  async setLeverage(_login: string, _leverage: number): Promise<void> {
    // Tradovate is a futures platform — leverage is implicit in margin requirements
    throw new Error('Tradovate leverage is set by contract margin, not account setting.');
  }

  async adjustBalance(login: string, amount: number, comment: string): Promise<void> {
    await this.request('/cashBalance/addcashbalanceentry', 'POST', {
      accountId: parseInt(login, 10), amount, note: comment,
    });
  }

  async deleteAccount(login: string): Promise<void> {
    await this.request(`/account/closeaccount`, 'POST', { accountId: parseInt(login, 10) });
  }
}
