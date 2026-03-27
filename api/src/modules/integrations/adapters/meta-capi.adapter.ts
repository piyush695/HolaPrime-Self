import type { IS2SAdapter, S2SEventPayload, FireResult } from '../adapter.interface.js';
import { sha256, hashIfPresent } from '../adapter.interface.js';

export class MetaCAPIAdapter implements IS2SAdapter {
  readonly type        = 'meta_capi';
  readonly displayName = 'Meta Conversions API';

  constructor(
    private readonly pixelId:     string,
    private readonly accessToken: string,
    private readonly testCode?:   string,   // TEST12345 — for Meta test events
  ) {}

  async healthCheck() {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${this.pixelId}?access_token=${this.accessToken}`,
      );
      const ok = res.ok;
      return { ok, message: ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      // IMPORTANT: event_id enables deduplication between browser Pixel and CAPI.
      // The same event_id must be passed to fbq('track', eventName, data, {eventID: eventId})
      // in the browser. Meta deduplicates on event_name + event_id pair.
      const eventId = (payload.custom?.eventId as string) 
        ?? payload.orderId 
        ?? `${payload.userId ?? 'anon'}-${payload.externalName}-${Math.floor(Date.now() / 1000)}`;

      // fbp and fbc must NOT be hashed — pass raw from browser cookies
      const fbp = payload.custom?.fbp as string | undefined;
      const fbc = payload.custom?.fbc as string | undefined 
        ?? (payload.fbclid ? `fb.1.${Date.now()}.${payload.fbclid}` : undefined);

      const body = {
        data: [{
          event_name:       payload.externalName,
          event_time:       payload.eventTime ?? Math.floor(Date.now() / 1000),
          event_id:         eventId,              // For deduplication with browser Pixel
          action_source:    'website',
          event_source_url: payload.custom?.pageUrl as string ?? 'https://app.holaprime.com',
          user_data: {
            // Hashed PII — SHA256 lowercase trim (Meta requirement)
            em:          payload.email    ? [sha256(payload.email.toLowerCase().trim())]    : undefined,
            ph:          payload.phone    ? [sha256(payload.phone.replace(/\D/g, ''))]       : undefined,
            fn:          payload.firstName ? [sha256(payload.firstName.toLowerCase().trim())] : undefined,
            ln:          payload.lastName  ? [sha256(payload.lastName.toLowerCase().trim())]  : undefined,
            country:     payload.countryCode ? [sha256(payload.countryCode.toLowerCase())]    : undefined,
            // NOT hashed — pass raw for matching quality
            client_ip_address: payload.ip,
            client_user_agent: payload.userAgent,
            fbp,                                   // Raw _fbp cookie — do NOT hash
            fbc,                                   // Raw _fbc cookie — do NOT hash
            // External ID hashed for cross-channel matching
            external_id: payload.userId ? [sha256(payload.userId)] : undefined,
          },
          custom_data: {
            value:        payload.value,
            currency:     payload.currency ?? 'USD',
            content_ids:  payload.productId ? [payload.productId] : undefined,
            content_name: payload.productName,
            content_type: payload.productId ? 'product' : undefined,
            order_id:     payload.orderId,
            // Spread remaining custom fields (excluding internal ones)
            ...Object.fromEntries(
              Object.entries(payload.custom ?? {}).filter(([k]) => !['fbp','fbc','fbclid','eventId','pageUrl','sessionId','clientId'].includes(k))
            ),
          },
          ...(this.testCode ? { test_event_code: this.testCode } : {}),
        }],
      };

      // Strip undefined/null recursively
      const cleaned = JSON.parse(JSON.stringify(body));

      const res = await fetch(
        `https://graph.facebook.com/v19.0/${this.pixelId}/events?access_token=${this.accessToken}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(cleaned),
        },
      );

      const responseBody = await res.text();
      return {
        success:      res.ok,
        statusCode:   res.status,
        responseBody: responseBody.slice(0, 500),
        durationMs:   Date.now() - t0,
        error:        res.ok ? undefined : responseBody.slice(0, 200),
      };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}
