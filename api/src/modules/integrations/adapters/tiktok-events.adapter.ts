import type { IS2SAdapter, S2SEventPayload, FireResult } from '../adapter.interface.js';
import { sha256, hashIfPresent } from '../adapter.interface.js';

export class TikTokEventsAdapter implements IS2SAdapter {
  readonly type        = 'tiktok_events';
  readonly displayName = 'TikTok Events API';

  constructor(
    private readonly pixelCode:   string,   // from TikTok Events Manager
    private readonly accessToken: string,
  ) {}

  async healthCheck() {
    // TikTok doesn't have a separate health check — attempt a test event
    const res = await this.fire({
      eventName:    'test',
      externalName: 'ViewContent',
      eventTime:    Math.floor(Date.now() / 1000),
    });
    return { ok: res.success, message: res.error };
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      const body = {
        pixel_code: this.pixelCode,
        event:      payload.externalName,
        timestamp:  new Date((payload.eventTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        context: {
          user: {
            email:      hashIfPresent(payload.email),
            phone_number: hashIfPresent(payload.phone?.replace(/\D/g, '')),
            external_id: payload.userId ? sha256(payload.userId) : undefined,
            ttp:        payload.custom?.ttp as string | undefined,
            ttclid:     payload.ttclid,
          },
          page: {
            url:      payload.custom?.url as string ?? 'https://app.holaprime.com',
            referrer: payload.custom?.referrer as string | undefined,
          },
          ip:         payload.ip,
          user_agent: payload.userAgent,
        },
        properties: {
          value:         payload.value,
          currency:      payload.currency ?? 'USD',
          content_id:    payload.productId,
          content_name:  payload.productName,
          content_type:  'product',
          order_id:      payload.orderId,
          ...payload.custom,
        },
      };

      const cleaned = JSON.parse(JSON.stringify(body));

      const res = await fetch(
        'https://business-api.tiktok.com/open_api/v1.3/event/track/',
        {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Token':  this.accessToken,
          },
          body: JSON.stringify(cleaned),
        },
      );

      const responseBody = await res.text();
      const parsed = JSON.parse(responseBody);
      const ok = res.ok && parsed.code === 0;

      return {
        success:      ok,
        statusCode:   res.status,
        responseBody: responseBody.slice(0, 500),
        durationMs:   Date.now() - t0,
        error:        ok ? undefined : (parsed.message ?? responseBody.slice(0, 200)),
      };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}
