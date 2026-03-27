// =============================================================================
// Trading Platform Adapter Interface
// Every platform (MT5, cTrader, MatchTrader, NinjaTrader, Tradovate) 
// must implement this interface. The rest of the system only talks to this
// interface — never to platform-specific code directly.
// =============================================================================

export type PlatformType = 'mt5' | 'ctrader' | 'matchtrader' | 'ninjatrader' | 'tradovate';

export interface PlatformCredentials {
  [key: string]: string | number | boolean;
}

export interface CreateAccountParams {
  login?:      string;       // optional — platform may auto-assign
  name:        string;       // trader display name
  email:       string;
  balance:     number;
  currency:    string;
  leverage:    number;
  group?:      string;       // server group (MT5) or account type
  password?:   string;       // if not set, auto-generate
  readonlyPw?: string;
  metadata?:   Record<string, unknown>;
}

export interface PlatformAccount {
  platformLogin:    string;
  platformServer:   string;
  mainPassword:     string;
  readonlyPassword: string;
  balance:          number;
  equity:           number;
  currency:         string;
  leverage:         number;
  group:            string;
  isActive:         boolean;
  createdAt:        Date;
}

export interface AccountBalance {
  login:     string;
  balance:   number;
  equity:    number;
  margin:    number;
  freeMargin:number;
  marginLevel: number | null;
  floatingPL: number;
  currency:  string;
  updatedAt: Date;
}

export interface Trade {
  ticket:      string;
  symbol:      string;
  direction:   'buy' | 'sell';
  lots:        number;
  openPrice:   number;
  closePrice:  number | null;
  sl:          number | null;
  tp:          number | null;
  commission:  number;
  swap:        number;
  profit:      number | null;
  openTime:    Date;
  closeTime:   Date | null;
  isOpen:      boolean;
}

export interface TradeHistory {
  trades:     Trade[];
  totalProfit: number;
  totalTrades: number;
  winRate:    number | null;
  fromDate:   Date;
  toDate:     Date;
}

export interface AccountLimits {
  maxLeverage?:       number;
  maxLotSize?:        number;
  allowedSymbols?:    string[];
  disabledSymbols?:   string[];
  tradingEnabled:     boolean;
  readonly:           boolean;
}

export interface HealthStatus {
  connected:  boolean;
  latencyMs:  number | null;
  serverTime: Date | null;
  message?:   string;
}

export interface IPlatformAdapter {
  readonly platform: PlatformType;

  /** Verify connection to the platform */
  healthCheck(): Promise<HealthStatus>;

  /** Create a new trading account on the platform */
  createAccount(params: CreateAccountParams): Promise<PlatformAccount>;

  /** Get account details and live balance */
  getAccount(login: string): Promise<PlatformAccount | null>;

  /** Get live balance/equity */
  getBalance(login: string): Promise<AccountBalance>;

  /** Get trade history for a date range */
  getTradeHistory(login: string, from: Date, to: Date): Promise<TradeHistory>;

  /** Get open trades */
  getOpenTrades(login: string): Promise<Trade[]>;

  /** Update account password */
  changePassword(login: string, newPassword: string, type?: 'main' | 'readonly'): Promise<void>;

  /** Enable or disable trading on an account */
  setTradingEnabled(login: string, enabled: boolean): Promise<void>;

  /** Change account leverage */
  setLeverage(login: string, leverage: number): Promise<void>;

  /** Deposit or withdraw funds (for funded accounts) */
  adjustBalance(login: string, amount: number, comment: string): Promise<void>;

  /** Delete/archive an account */
  deleteAccount(login: string): Promise<void>;
}
