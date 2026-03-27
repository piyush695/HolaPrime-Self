// ── S2S Integration Adapter Interface ─────────────────────────────────────────
// Every integration (Meta CAPI, GA4, TikTok etc.) implements this.
// The EventBus calls fire() — adapters handle all platform-specific logic.

export interface S2SEventPayload {
  // Standard identity fields (hashed where required by the platform)
  userId?:      string;
  email?:       string;
  phone?:       string;
  firstName?:   string;
  lastName?:    string;
  countryCode?: string;
  ip?:          string;
  userAgent?:   string;
  // Event data
  eventName:    string;         // internal event, e.g. 'payment.completed'
  externalName: string;         // mapped name, e.g. 'Purchase'
  value?:       number;         // revenue value
  currency?:    string;
  productId?:   string;
  productName?: string;
  orderId?:     string;
  // Attribution
  utmSource?:   string;
  utmMedium?:   string;
  utmCampaign?: string;
  fbclid?:      string;
  gclid?:       string;
  ttclid?:      string;
  // Additional custom fields
  custom?:      Record<string, unknown>;
  // Timestamps
  eventTime?:   number;         // unix timestamp — defaults to now
}

export interface FireResult {
  success:      boolean;
  statusCode?:  number;
  responseBody?: string;
  durationMs:   number;
  error?:       string;
}

export interface IS2SAdapter {
  readonly type:        string;
  readonly displayName: string;

  /** Verify credentials are valid */
  healthCheck(): Promise<{ ok: boolean; message?: string }>;

  /** Send a single event */
  fire(payload: S2SEventPayload): Promise<FireResult>;
}

// ── SHA-256 helper for hashing PII before sending ─────────────────────────────
import { createHash } from 'crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function hashIfPresent(value: string | undefined): string | undefined {
  return value ? sha256(value) : undefined;
}
