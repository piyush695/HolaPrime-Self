import { query, queryOne } from '../../db/index.js';
import type { IS2SAdapter, S2SEventPayload } from './adapter.interface.js';
import { MetaCAPIAdapter }   from './adapters/meta-capi.adapter.js';
import { GA4Adapter }        from './adapters/ga4.adapter.js';
import { TikTokEventsAdapter } from './adapters/tiktok-events.adapter.js';
import {
  MixpanelAdapter, SegmentAdapter, AmplitudeAdapter,
  PostHogAdapter, KlaviyoAdapter, CustomHttpAdapter,
} from './adapters/misc.adapters.js';
import {
  TaboolaAdapter, OutbrainAdapter, SnapchatAdapter,
  PinterestAdapter, LinkedInAdapter,
} from './adapters/new-platforms.adapter.js';

// ── Internal event names (all events the platform can fire) ───────────────────
export const INTERNAL_EVENTS = [
  'user.registered',
  'user.email_verified',
  'user.kyc_submitted',
  'user.kyc_approved',
  'user.kyc_rejected',
  'account.created',
  'account.passed',
  'account.funded',
  'account.breached',
  'payment.initiated',
  'payment.completed',
  'payment.failed',
  'payout.requested',
  'payout.approved',
  'payout.rejected',
  'tournament.registered',
  'tournament.qualified',
] as const;

export type InternalEvent = typeof INTERNAL_EVENTS[number];

// ── Adapter factory ───────────────────────────────────────────────────────────
function buildAdapter(type: string, config: Record<string, string>): IS2SAdapter {
  switch (type) {
    case 'meta_capi':
      return new MetaCAPIAdapter(config.pixelId, config.accessToken, config.testCode);
    case 'google_ga4':
      return new GA4Adapter(config.measurementId, config.apiSecret);
    case 'tiktok_events':
      return new TikTokEventsAdapter(config.pixelCode, config.accessToken);
    case 'mixpanel':
      return new MixpanelAdapter(config.projectToken);
    case 'segment':
      return new SegmentAdapter(config.writeKey);
    case 'amplitude':
      return new AmplitudeAdapter(config.apiKey);
    case 'posthog':
      return new PostHogAdapter(config.apiKey, config.host);
    case 'klaviyo':
      return new KlaviyoAdapter(config.privateKey);
    case 'custom_http':
      return new CustomHttpAdapter(
        config.url, config.method ?? 'POST',
        config.headers ? JSON.parse(config.headers) : {},
        config.template,
      );
    case 'taboola':
      return new TaboolaAdapter(config.clientId, config.clientSecret);
    case 'outbrain':
      return new OutbrainAdapter(config.pixelId, config.apiKey);
    case 'snapchat':
      return new SnapchatAdapter(config.pixelId, config.accessToken);
    case 'pinterest':
      return new PinterestAdapter(config.adAccountId, config.accessToken);
    case 'linkedin':
      return new LinkedInAdapter(config.accessToken, config.conversionRuleId, config.adAccountId);
    default:
      throw new Error(`Unknown integration type: ${type}`);
  }
}

// Cache adapters (reload when config changes)
const adapterCache = new Map<string, IS2SAdapter>();

function getAdapter(id: string, type: string, config: Record<string, string>): IS2SAdapter {
  if (!adapterCache.has(id)) {
    adapterCache.set(id, buildAdapter(type, config));
  }
  return adapterCache.get(id)!;
}

export function clearAdapterCache(id?: string) {
  if (id) adapterCache.delete(id);
  else adapterCache.clear();
}

// ── EventBus ──────────────────────────────────────────────────────────────────
export async function fireEvent(
  internalEvent: string,
  data: Omit<S2SEventPayload, 'eventName' | 'externalName'>,
): Promise<void> {
  // Find all active integrations that are subscribed to this event
  const integrations = await query<{
    id: string; type: string; config: Record<string, string>;
    event_map: Record<string, string>; field_map: Record<string, string>;
  }>(`
    SELECT id, type, config, event_map, field_map
    FROM s2s_integrations
    WHERE is_active = true
      AND event_map ? $1
  `, [internalEvent]);

  if (integrations.length === 0) return;

  // Fan out to all integrations in parallel (fire-and-forget with logging)
  await Promise.allSettled(
    integrations.map(async (integration) => {
      const externalName = integration.event_map[internalEvent];
      const adapter      = getAdapter(integration.id, integration.type, integration.config);

      const payload: S2SEventPayload = {
        ...data,
        eventName:    internalEvent,
        externalName: externalName,
        eventTime:    Math.floor(Date.now() / 1000),
      };

      const t0     = Date.now();
      let   result = { success: false, statusCode: 0, responseBody: '', durationMs: 0, error: '' };

      try {
        result = { ...result, ...(await adapter.fire(payload)) };
      } catch (err) {
        result.error     = String(err);
        result.durationMs = Date.now() - t0;
      }

      // Log to DB
      await query(`
        INSERT INTO s2s_event_log
          (integration_id, internal_event, external_event, user_id,
           payload_sent, response_status, response_body,
           success, duration_ms, error, fired_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      `, [
        integration.id, internalEvent, externalName,
        data.userId ?? null,
        JSON.stringify(payload),
        result.statusCode,
        result.responseBody?.slice(0, 500) ?? null,
        result.success,
        result.durationMs,
        result.error ?? null,
      ]);

      // Update last_fired_at on integration
      await query(
        'UPDATE s2s_integrations SET last_fired_at = NOW() WHERE id = $1',
        [integration.id],
      );
    }),
  );
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function listIntegrations() {
  return query(`
    SELECT i.*,
      (SELECT COUNT(*) FROM s2s_event_log el WHERE el.integration_id = i.id) AS total_events,
      (SELECT COUNT(*) FROM s2s_event_log el WHERE el.integration_id = i.id AND el.success = false) AS failed_events,
      (SELECT COUNT(*) FROM s2s_event_log el WHERE el.integration_id = i.id AND el.fired_at > NOW() - INTERVAL '24h') AS events_24h
    FROM s2s_integrations i
    ORDER BY i.created_at DESC
  `);
}

export async function getIntegration(id: string) {
  const integration = await queryOne(
    'SELECT * FROM s2s_integrations WHERE id = $1', [id],
  );
  if (!integration) return null;

  const recentLogs = await query(`
    SELECT id, internal_event, external_event, success, duration_ms,
           response_status, error, is_test, fired_at
    FROM s2s_event_log
    WHERE integration_id = $1
    ORDER BY fired_at DESC LIMIT 50
  `, [id]);

  return { ...integration, recentLogs };
}

export async function createIntegration(data: {
  name: string; type: string; config: Record<string, unknown>;
  eventMap: Record<string, string>; fieldMap?: Record<string, string>;
  isActive?: boolean;
}, adminId: string): Promise<string> {
  const [i] = await query<{ id: string }>(`
    INSERT INTO s2s_integrations (name, type, config, event_map, field_map, is_active, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [
    data.name, data.type,
    JSON.stringify(data.config),
    JSON.stringify(data.eventMap),
    JSON.stringify(data.fieldMap ?? {}),
    data.isActive ?? false,
    adminId,
  ]);
  return i.id;
}

export async function updateIntegration(id: string, data: {
  name?: string; config?: Record<string, unknown>;
  eventMap?: Record<string, string>; isActive?: boolean;
}): Promise<void> {
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let i = 1;

  if (data.name     !== undefined) { sets.push(`name = $${i++}`);       vals.push(data.name); }
  if (data.config   !== undefined) { sets.push(`config = $${i++}`);     vals.push(JSON.stringify(data.config)); }
  if (data.eventMap !== undefined) { sets.push(`event_map = $${i++}`);  vals.push(JSON.stringify(data.eventMap)); }
  if (data.isActive !== undefined) { sets.push(`is_active = $${i++}`);  vals.push(data.isActive); }

  await query(`UPDATE s2s_integrations SET ${sets.join(', ')} WHERE id = $${i}`, [...vals, id]);
  clearAdapterCache(id);
}

export async function deleteIntegration(id: string): Promise<void> {
  await query('DELETE FROM s2s_integrations WHERE id = $1', [id]);
  clearAdapterCache(id);
}

export async function testFireIntegration(id: string, eventName: string): Promise<{
  success: boolean; durationMs: number; response?: string; error?: string;
}> {
  const integration = await queryOne<{
    id: string; type: string; config: Record<string, string>;
    event_map: Record<string, string>;
  }>('SELECT id, type, config, event_map FROM s2s_integrations WHERE id = $1', [id]);

  if (!integration) throw new Error('Integration not found');

  const externalName = integration.event_map[eventName] ?? eventName;
  const adapter      = getAdapter(id, integration.type, integration.config);

  const result = await adapter.fire({
    eventName,
    externalName,
    userId:      'test_user_123',
    email:       'test@holaprime.com',
    firstName:   'Test',
    lastName:    'User',
    value:       149,
    currency:    'USD',
    productName: 'Test Challenge $10,000',
    eventTime:   Math.floor(Date.now() / 1000),
  });

  // Log it as a test event
  await query(`
    INSERT INTO s2s_event_log
      (integration_id, internal_event, external_event,
       payload_sent, response_status, success, duration_ms, error, is_test, fired_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW())
  `, [
    id, eventName, externalName,
    JSON.stringify({ test: true }),
    result.statusCode, result.success, result.durationMs, result.error ?? null,
  ]);

  return {
    success:    result.success,
    durationMs: result.durationMs,
    response:   result.responseBody,
    error:      result.error,
  };
}

export async function getEventStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(DISTINCT integration_id) AS active_integrations,
      COUNT(*) AS total_events_24h,
      COUNT(*) FILTER (WHERE success = true) AS successful_24h,
      COUNT(*) FILTER (WHERE success = false) AS failed_24h,
      ROUND(
        COUNT(*) FILTER (WHERE success = true)::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 1
      ) AS success_rate
    FROM s2s_event_log
    WHERE fired_at > NOW() - INTERVAL '24 hours'
  `);
  return stats;
}
