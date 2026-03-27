import type { IPlatformAdapter, PlatformType } from './adapter.interface.js';
import { MT5Adapter } from './mt5/mt5.adapter.js';
import { CTraderAdapter } from './ctrader/ctrader.adapter.js';
import { MatchTraderAdapter } from './matchtrader/matchtrader.adapter.js';
import { NinjaTraderAdapter, TradovateAdapter } from './ninjatrader/ninjatrader.tradovate.adapters.js';
import { config } from '../config/index.js';
import { queryOne } from '../db/index.js';

// Adapter cache — keyed by platform
const adapters = new Map<string, IPlatformAdapter>();

export function clearAdapterCache(platform?: PlatformType) {
  if (platform) adapters.delete(platform);
  else adapters.clear();
}

// Build adapter from credentials object (DB-backed)
function buildAdapterFromCreds(platform: PlatformType, creds: Record<string, string>): IPlatformAdapter {
  switch (platform) {
    case 'mt5':
      return new MT5Adapter(creds.apiUrl || config.platforms.mt5.apiUrl, creds.apiKey || config.platforms.mt5.apiKey, creds.server || config.platforms.mt5.server);
    case 'ctrader':
      return new CTraderAdapter(creds.clientId || config.platforms.ctrader.clientId, creds.clientSecret || config.platforms.ctrader.clientSecret, creds.accountId || config.platforms.ctrader.accountId, (creds.env || config.platforms.ctrader.env) as 'demo' | 'live');
    case 'matchtrader':
      return new MatchTraderAdapter(creds.apiUrl || config.platforms.matchtrader.apiUrl, creds.apiKey || config.platforms.matchtrader.apiKey, creds.brokerId || config.platforms.matchtrader.brokerId);
    case 'ninjatrader':
      return new NinjaTraderAdapter(creds.apiUrl || config.platforms.ninjatrader.apiUrl, creds.apiKey || config.platforms.ninjatrader.apiKey, creds.accountNumber || config.platforms.ninjatrader.accountNumber);
    case 'tradovate':
      return new TradovateAdapter(creds.apiUrl || config.platforms.tradovate.apiUrl, creds.username || config.platforms.tradovate.username, creds.password || config.platforms.tradovate.password, creds.appId || config.platforms.tradovate.appId, creds.appVersion || config.platforms.tradovate.appVersion);
    default:
      throw new Error(`Unsupported platform: ${platform as string}`);
  }
}

export function getPlatformAdapter(platform: PlatformType): IPlatformAdapter {
  if (!adapters.has(platform)) {
    // Fall back to env-based config (sync) while DB lookup is async
    adapters.set(platform, buildAdapterFromCreds(platform, {}));
  }
  return adapters.get(platform)!;
}

// Async version — loads from DB first (use this in background jobs)
export async function getPlatformAdapterAsync(platform: PlatformType): Promise<IPlatformAdapter> {
  if (adapters.has(platform)) return adapters.get(platform)!;
  
  try {
    const row = await queryOne<{ credentials: Record<string, string>; is_active: boolean }>(
      'SELECT credentials, is_active FROM platform_credentials WHERE platform = $1',
      [platform],
    );
    if (row?.credentials && Object.keys(row.credentials).length > 0) {
      const adapter = buildAdapterFromCreds(platform, row.credentials);
      adapters.set(platform, adapter);
      return adapter;
    }
  } catch {
    // DB not ready yet — fall through to env config
  }
  
  const adapter = buildAdapterFromCreds(platform, {});
  adapters.set(platform, adapter);
  return adapter;
}

export const SUPPORTED_PLATFORMS: PlatformType[] = [
  'mt5', 'ctrader', 'matchtrader', 'ninjatrader', 'tradovate',
];

export async function checkAllPlatformHealth(): Promise<Record<string, { connected: boolean; latencyMs: number | null; message?: string }>> {
  const results = await Promise.allSettled(
    SUPPORTED_PLATFORMS.map(async (p) => ({
      platform: p,
      health: await (await getPlatformAdapterAsync(p)).healthCheck(),
    })),
  );

  const out: Record<string, { connected: boolean; latencyMs: number | null; message?: string }> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      out[r.value.platform] = r.value.health;
    }
  }
  return out;
}
