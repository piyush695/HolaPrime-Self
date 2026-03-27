import type { IS2SAdapter, S2SEventPayload, FireResult } from '../adapter.interface.js';

export class GA4Adapter implements IS2SAdapter {
  readonly type        = 'google_ga4';
  readonly displayName = 'Google Analytics 4 (MP)';

  constructor(
    private readonly measurementId: string,  // G-XXXXXXXXXX
    private readonly apiSecret:     string,  // from GA4 → Admin → Data Streams → Measurement Protocol API secrets
  ) {}

  async healthCheck() {
    // GA4 MP doesn't have a dedicated health endpoint — do a validation hit
    try {
      const res = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id:  'health_check',
            events:     [{ name: 'page_view' }],
          }),
        },
      );
      return { ok: res.ok, message: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  }

  async fire(payload: S2SEventPayload): Promise<FireResult> {
    const t0 = Date.now();
    try {
      // Build event params
      const eventParams: Record<string, unknown> = {
        session_id: payload.custom?.sessionId as string ?? payload.orderId ?? Date.now().toString(),
        engagement_time_msec: 100,
      };

      if (payload.value !== undefined) eventParams.value         = payload.value;
      if (payload.currency)           eventParams.currency       = payload.currency;
      if (payload.productId)          eventParams.item_id        = payload.productId;
      if (payload.productName)        eventParams.item_name      = payload.productName;
      if (payload.orderId)            eventParams.transaction_id = payload.orderId;
      if (payload.utmSource)          eventParams.source         = payload.utmSource;
      if (payload.utmMedium)          eventParams.medium         = payload.utmMedium;
      if (payload.utmCampaign)        eventParams.campaign       = payload.utmCampaign;

      // Merge custom fields
      if (payload.custom) Object.assign(eventParams, payload.custom);

      const body = {
        client_id:    payload.userId ?? payload.custom?.clientId as string ?? 'anonymous',
        user_id:      payload.userId,
        timestamp_micros: (payload.eventTime ?? Math.floor(Date.now() / 1000)) * 1_000_000,
        user_properties: {
          ...(payload.countryCode ? { country: { value: payload.countryCode } } : {}),
        },
        events: [{
          name:   payload.externalName,
          params: eventParams,
        }],
      };

      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(JSON.parse(JSON.stringify(body))), // strip undefined
        },
      );

      // GA4 MP returns 204 No Content on success
      return {
        success:    res.status === 204 || res.ok,
        statusCode: res.status,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      return { success: false, durationMs: Date.now() - t0, error: String(err) };
    }
  }
}
