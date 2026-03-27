import type { IS2SAdapter, S2SEventPayload, FireResult } from '../adapter.interface.js';
import { sha256 } from '../adapter.interface.js';

// ── Helper ────────────────────────────────────────────────────────────────────
async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<FireResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const responseBody = await res.text();
    return {
      success:      res.ok,
      statusCode:   res.status,
      responseBody,
      durationMs:   Date.now() - start,
      error:        res.ok ? undefined : `HTTP ${res.status}: ${responseBody}`,
    };
  } catch (err) {
    return { success: false, durationMs: Date.now() - start, error: String(err) };
  }
}

// =============================================================================
// TABOOLA  — Conversions API
// Docs: https://developers.taboola.com/backstage-api/reference/conversions
// =============================================================================
export class TaboolaAdapter implements IS2SAdapter {
  readonly type        = 'taboola';
  readonly displayName = 'Taboola Conversions API';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async healthCheck() {
    try {
      const res = await fetch(
        `https://backstage.taboola.com/backstage/oauth/token`,
        { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`,
        },
      );
      return { ok: res.ok, message: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const start = Date.now();
    try {
      // Get access token
      const tokenRes = await fetch('https://backstage.taboola.com/backstage/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`,
      });
      const { access_token } = await tokenRes.json() as { access_token: string };

      const body = {
        event_name:     payload.externalName,
        event_time:     payload.eventTime ?? Math.floor(Date.now() / 1000),
        click_id:       payload.custom?.tblci,
        revenue:        payload.value,
        currency:       payload.currency ?? 'USD',
        email:          payload.email ? sha256(payload.email) : undefined,
      };

      return postJson(
        `https://backstage.taboola.com/backstage/api/1.0/${this.clientId}/conversionapi`,
        body,
        { Authorization: `Bearer ${access_token}` },
      );
    } catch (err) {
      return { success: false, durationMs: Date.now() - start, error: String(err) };
    }
  }
}

// =============================================================================
// OUTBRAIN  — Conversions API
// Docs: https://amplifyv01.outbrain.com/cmp/docs/conversions-api
// =============================================================================
export class OutbrainAdapter implements IS2SAdapter {
  readonly type        = 'outbrain';
  readonly displayName = 'Outbrain Conversions API';

  constructor(
    private readonly pixelId: string,
    private readonly apiKey:  string,
  ) {}

  async healthCheck() {
    return { ok: !!this.apiKey, message: this.apiKey ? undefined : 'API key missing' };
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const body = {
      pixelId:    this.pixelId,
      timestamp:  new Date((payload.eventTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      eventName:  payload.externalName,
      userId:     payload.userId,
      orderValue: payload.value,
      currency:   payload.currency ?? 'USD',
      userDetails: {
        hashedEmail: payload.email ? sha256(payload.email) : undefined,
        country:     payload.countryCode,
      },
    };

    return postJson(
      'https://tr.outbrain.com/unifiedPixel/conversionapi',
      body,
      { 'OB-TOKEN-V1': this.apiKey },
    );
  }
}

// =============================================================================
// SNAPCHAT  — Conversions API
// Docs: https://developers.snap.com/api/conversion-api
// =============================================================================
export class SnapchatAdapter implements IS2SAdapter {
  readonly type        = 'snapchat';
  readonly displayName = 'Snapchat Conversions API';

  constructor(
    private readonly pixelId:     string,
    private readonly accessToken: string,
  ) {}

  async healthCheck() {
    return { ok: !!this.accessToken };
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const body = {
      pixel_id:   this.pixelId,
      test_event_code: (payload.custom?.testCode as string) ?? undefined,
      data: [{
        event_type:      payload.externalName,
        event_time:      payload.eventTime ?? Math.floor(Date.now() / 1000),
        event_source_url: `https://app.holaprime.com`,
        user_data: {
          em:              payload.email ? [sha256(payload.email)] : [],
          ph:              payload.phone ? [sha256(payload.phone)] : [],
          client_ip_address: payload.ip,
          client_user_agent: payload.userAgent,
          sc_click_id:     payload.custom?.scclid,
        },
        custom_data: {
          currency:    payload.currency ?? 'USD',
          value:       payload.value,
          order_id:    payload.orderId,
          content_ids: payload.productId ? [payload.productId] : [],
        },
      }],
    };

    return postJson(
      'https://tr.snapchat.com/v2/conversion',
      body,
      { Authorization: `Bearer ${this.accessToken}` },
    );
  }
}

// =============================================================================
// PINTEREST  — Conversions API
// Docs: https://developers.pinterest.com/docs/conversions/conversion-management
// =============================================================================
export class PinterestAdapter implements IS2SAdapter {
  readonly type        = 'pinterest';
  readonly displayName = 'Pinterest Conversions API';

  constructor(
    private readonly adAccountId: string,
    private readonly accessToken: string,
  ) {}

  async healthCheck() {
    return { ok: !!this.accessToken };
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const body = {
      data: [{
        event_name:   payload.externalName,
        action_source: 'web',
        event_time:   payload.eventTime ?? Math.floor(Date.now() / 1000),
        event_source_url: `https://app.holaprime.com`,
        user_data: {
          em:    payload.email ? [sha256(payload.email)] : [],
          ph:    payload.phone ? [sha256(payload.phone)] : [],
          client_ip_address: payload.ip,
          client_user_agent: payload.userAgent,
        },
        custom_data: {
          value:    payload.value?.toString(),
          currency: payload.currency ?? 'USD',
          order_id: payload.orderId,
          content_ids: payload.productId ? [payload.productId] : [],
        },
      }],
    };

    return postJson(
      `https://api.pinterest.com/v5/ad_accounts/${this.adAccountId}/events`,
      body,
      { Authorization: `Bearer ${this.accessToken}` },
    );
  }
}

// =============================================================================
// LINKEDIN  — Conversions API (CAPI)
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/conversions
// =============================================================================
export class LinkedInAdapter implements IS2SAdapter {
  readonly type        = 'linkedin';
  readonly displayName = 'LinkedIn Insight Tag / CAPI';

  constructor(
    private readonly accessToken:    string,
    private readonly conversionRuleId: string,
    private readonly adAccountId:    string,
  ) {}

  async healthCheck() {
    return { ok: !!this.accessToken };
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const body = {
      conversion:      `urn:li:fsConversion:(urn:li:sponsoredAccount:${this.adAccountId},${this.conversionRuleId})`,
      conversionHappenedAt: (payload.eventTime ?? Math.floor(Date.now() / 1000)) * 1000,
      conversionValue: payload.value ? { amount: String(payload.value), currencyCode: payload.currency ?? 'USD' } : undefined,
      user: {
        userIds: payload.email ? [{ idType: 'SHA256_EMAIL', idValue: sha256(payload.email) }] : [],
        userInfo: {
          firstName: payload.firstName,
          lastName:  payload.lastName,
          countryCode: payload.countryCode,
        },
      },
    };

    return postJson(
      'https://api.linkedin.com/rest/conversionEvents',
      body,
      {
        Authorization:        `Bearer ${this.accessToken}`,
        'LinkedIn-Version':   '202402',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    );
  }
}
