import type { IS2SAdapter, S2SEventPayload, FireResult } from '../adapter.interface.js';

// ── Mixpanel ──────────────────────────────────────────────────────────────────
export class MixpanelAdapter implements IS2SAdapter {
  readonly type        = 'mixpanel';
  readonly displayName = 'Mixpanel';

  constructor(private readonly projectToken: string) {}

  async healthCheck() {
    return { ok: !!this.projectToken, message: this.projectToken ? undefined : 'No project token' };
  }

  async fire(p: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      const event = {
        event:      p.externalName,
        properties: {
          token:       this.projectToken,
          distinct_id: p.userId ?? p.email ?? 'anonymous',
          time:        p.eventTime ?? Math.floor(Date.now() / 1000),
          $email:      p.email,
          $name:       [p.firstName, p.lastName].filter(Boolean).join(' ') || undefined,
          $country_code: p.countryCode,
          $ip:         p.ip,
          value:       p.value,
          currency:    p.currency,
          product_id:  p.productId,
          order_id:    p.orderId,
          utm_source:  p.utmSource,
          utm_medium:  p.utmMedium,
          utm_campaign:p.utmCampaign,
          ...p.custom,
        },
      };

      const data = Buffer.from(JSON.stringify(JSON.parse(JSON.stringify(event)))).toString('base64');
      const res  = await fetch(`https://api.mixpanel.com/track?data=${data}&verbose=1`);
      const body = await res.text();

      return { success: res.ok, statusCode: res.status, responseBody: body, durationMs: Date.now() - t0 };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}

// ── Segment ───────────────────────────────────────────────────────────────────
export class SegmentAdapter implements IS2SAdapter {
  readonly type        = 'segment';
  readonly displayName = 'Segment';

  constructor(private readonly writeKey: string) {}

  async healthCheck() {
    return { ok: !!this.writeKey };
  }

  async fire(p: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      const body = {
        userId:     p.userId,
        anonymousId:p.userId ? undefined : `anon_${Date.now()}`,
        event:      p.externalName,
        timestamp:  new Date((p.eventTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        properties: {
          value:       p.value,
          currency:    p.currency,
          product_id:  p.productId,
          order_id:    p.orderId,
          utm_source:  p.utmSource,
          utm_medium:  p.utmMedium,
          utm_campaign:p.utmCampaign,
          ...p.custom,
        },
        context: {
          ip:         p.ip,
          userAgent:  p.userAgent,
          traits: {
            email:      p.email,
            firstName:  p.firstName,
            lastName:   p.lastName,
            country:    p.countryCode,
          },
        },
      };

      const auth = Buffer.from(`${this.writeKey}:`).toString('base64');
      const res  = await fetch('https://api.segment.io/v1/track', {
        method:  'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(JSON.parse(JSON.stringify(body))),
      });

      return { success: res.ok, statusCode: res.status, durationMs: Date.now() - t0 };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}

// ── Amplitude ─────────────────────────────────────────────────────────────────
export class AmplitudeAdapter implements IS2SAdapter {
  readonly type        = 'amplitude';
  readonly displayName = 'Amplitude';

  constructor(private readonly apiKey: string) {}

  async healthCheck() {
    return { ok: !!this.apiKey };
  }

  async fire(p: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      const body = {
        api_key: this.apiKey,
        events: [{
          user_id:    p.userId,
          device_id:  p.userId ? undefined : `anon_${Date.now()}`,
          event_type: p.externalName,
          time:       (p.eventTime ?? Math.floor(Date.now() / 1000)) * 1000,
          ip:         p.ip,
          country:    p.countryCode,
          event_properties: {
            value:       p.value,
            currency:    p.currency,
            product_id:  p.productId,
            order_id:    p.orderId,
            utm_source:  p.utmSource,
            utm_medium:  p.utmMedium,
            utm_campaign:p.utmCampaign,
            ...p.custom,
          },
          user_properties: {
            email:      p.email,
            first_name: p.firstName,
            last_name:  p.lastName,
          },
        }],
      };

      const res  = await fetch('https://api2.amplitude.com/2/httpapi', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(JSON.parse(JSON.stringify(body))),
      });

      const rb = await res.text();
      return { success: res.ok, statusCode: res.status, responseBody: rb, durationMs: Date.now() - t0 };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}

// ── PostHog ───────────────────────────────────────────────────────────────────
export class PostHogAdapter implements IS2SAdapter {
  readonly type        = 'posthog';
  readonly displayName = 'PostHog';

  constructor(
    private readonly apiKey: string,
    private readonly host:   string = 'https://app.posthog.com',
  ) {}

  async healthCheck() {
    return { ok: !!this.apiKey };
  }

  async fire(p: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      const body = {
        api_key:       this.apiKey,
        distinct_id:   p.userId ?? p.email ?? 'anonymous',
        event:         p.externalName,
        timestamp:     new Date((p.eventTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        properties: {
          $ip:          p.ip,
          $set: {
            email:      p.email,
            first_name: p.firstName,
            last_name:  p.lastName,
            country:    p.countryCode,
          },
          value:        p.value,
          currency:     p.currency,
          product_id:   p.productId,
          order_id:     p.orderId,
          utm_source:   p.utmSource,
          utm_medium:   p.utmMedium,
          utm_campaign: p.utmCampaign,
          ...p.custom,
        },
      };

      const res = await fetch(`${this.host}/capture/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(JSON.parse(JSON.stringify(body))),
      });

      return { success: res.ok, statusCode: res.status, durationMs: Date.now() - t0 };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}

// ── Klaviyo ───────────────────────────────────────────────────────────────────
export class KlaviyoAdapter implements IS2SAdapter {
  readonly type        = 'klaviyo';
  readonly displayName = 'Klaviyo';

  constructor(private readonly privateKey: string) {}

  async healthCheck() {
    try {
      const res = await fetch('https://a.klaviyo.com/api/accounts/', {
        headers: { 'Authorization': `Klaviyo-API-Key ${this.privateKey}`, 'revision': '2024-02-15' },
      });
      return { ok: res.ok };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  async fire(p: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      const body = {
        data: {
          type:       'event',
          attributes: {
            metric:     { data: { type: 'metric', attributes: { name: p.externalName } } },
            profile:    {
              data: {
                type: 'profile',
                attributes: {
                  email:      p.email,
                  phone_number: p.phone,
                  first_name: p.firstName,
                  last_name:  p.lastName,
                  location:   p.countryCode ? { country: p.countryCode } : undefined,
                  external_id: p.userId,
                },
              },
            },
            properties: {
              value:       p.value,
              currency:    p.currency,
              product_id:  p.productId,
              order_id:    p.orderId,
              ...p.custom,
            },
            time: new Date((p.eventTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            value: p.value,
            value_currency: p.currency ?? 'USD',
          },
        },
      };

      const res = await fetch('https://a.klaviyo.com/api/events/', {
        method:  'POST',
        headers: {
          'Authorization':  `Klaviyo-API-Key ${this.privateKey}`,
          'Content-Type':   'application/json',
          'revision':       '2024-02-15',
        },
        body: JSON.stringify(JSON.parse(JSON.stringify(body))),
      });

      return { success: res.ok || res.status === 202, statusCode: res.status, durationMs: Date.now() - t0 };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}

// ── Custom HTTP ───────────────────────────────────────────────────────────────
export class CustomHttpAdapter implements IS2SAdapter {
  readonly type        = 'custom_http';
  readonly displayName = 'Custom HTTP Endpoint';

  constructor(
    private readonly url:     string,
    private readonly method:  string = 'POST',
    private readonly headers: Record<string, string> = {},
    private readonly template?: string,   // optional JSON template with {{field}} placeholders
  ) {}

  async healthCheck() {
    try {
      const res = await fetch(this.url, { method: 'GET', headers: this.headers, signal: AbortSignal.timeout(5000) });
      return { ok: res.ok || res.status === 405, message: undefined }; // 405 = endpoint exists but GET not allowed
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  async fire(p: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      let body: string;

      if (this.template) {
        // Replace {{field}} placeholders
        body = this.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          const map: Record<string, unknown> = {
            userId: p.userId, email: p.email, phone: p.phone,
            firstName: p.firstName, lastName: p.lastName,
            eventName: p.eventName, externalName: p.externalName,
            value: p.value, currency: p.currency,
            productId: p.productId, productName: p.productName,
            orderId: p.orderId, countryCode: p.countryCode,
            utmSource: p.utmSource, utmMedium: p.utmMedium, utmCampaign: p.utmCampaign,
            ...p.custom,
          };
          return String(map[key] ?? '');
        });
      } else {
        body = JSON.stringify({
          event:   p.externalName,
          userId:  p.userId,
          email:   p.email,
          value:   p.value,
          currency:p.currency,
          orderId: p.orderId,
          ts:      p.eventTime ?? Math.floor(Date.now() / 1000),
          ...p.custom,
        });
      }

      const res = await fetch(this.url, {
        method:  this.method,
        headers: { 'Content-Type': 'application/json', ...this.headers },
        body,
        signal:  AbortSignal.timeout(10_000),
      });

      const rb = await res.text();
      return { success: res.ok, statusCode: res.status, responseBody: rb.slice(0, 500), durationMs: Date.now() - t0 };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}
