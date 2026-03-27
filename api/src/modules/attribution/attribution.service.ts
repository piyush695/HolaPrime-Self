import { query, queryOne, withTransaction } from '../../db/index.js';

// ── Channel grouping rules ────────────────────────────────────────────────────
export function deriveChannel(params: {
  utmSource?: string; utmMedium?: string; referrer?: string;
  gclid?: string; fbclid?: string; ttclid?: string;
}): string {
  const { utmSource, utmMedium, referrer, gclid, fbclid, ttclid } = params;
  const src = utmSource?.toLowerCase() ?? '';
  const med = utmMedium?.toLowerCase() ?? '';

  if (gclid || src.includes('google') && ['cpc','ppc','paid'].some(m => med.includes(m))) return 'Paid Search';
  if (fbclid || ['facebook','instagram','meta'].some(s => src.includes(s)) && ['cpc','paid','social'].some(m => med.includes(m))) return 'Paid Social';
  if (ttclid || src.includes('tiktok') && med.includes('paid')) return 'Paid Social';
  if (['email','newsletter'].some(m => med.includes(m))) return 'Email';
  if (med.includes('affiliate') || med.includes('referral')) return 'Affiliate';
  if (['whatsapp','sms'].some(s => src.includes(s) || med.includes(s))) return 'WhatsApp/SMS';
  if (['organic','seo'].some(m => med.includes(m)) || (referrer && !referrer.includes(process.env.FRONTEND_URL ?? 'holaprime'))) return 'Organic Search';
  if (['facebook','twitter','linkedin','youtube','tiktok','instagram'].some(s => src.includes(s) || (referrer ?? '').includes(s))) return 'Organic Social';
  if (src === 'direct' || (!src && !referrer)) return 'Direct';
  return 'Other';
}

// ── Track event (called from middleware on every page load / action) ───────────
export async function trackEvent(params: {
  anonymousId?: string; userId?: string; sessionId?: string;
  eventName: string; pageUrl?: string; referrer?: string;
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
  utmTerm?: string; utmContent?: string;
  gclid?: string; fbclid?: string; ttclid?: string;
  deviceType?: string; countryCode?: string; ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const channel = deriveChannel({
    utmSource:  params.utmSource,
    utmMedium:  params.utmMedium,
    referrer:   params.referrer,
    gclid:      params.gclid,
    fbclid:     params.fbclid,
    ttclid:     params.ttclid,
  });

  await query(`
    INSERT INTO attribution_events
      (anonymous_id, user_id, session_id, event_name, page_url, referrer,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       gclid, fbclid, ttclid, channel,
       device_type, country_code, ip_address, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
  `, [
    params.anonymousId, params.userId, params.sessionId,
    params.eventName, params.pageUrl, params.referrer,
    params.utmSource, params.utmMedium, params.utmCampaign,
    params.utmTerm, params.utmContent,
    params.gclid, params.fbclid, params.ttclid, channel,
    params.deviceType, params.countryCode, params.ipAddress,
    JSON.stringify(params.metadata ?? {}),
  ]);
}

// ── Record touchpoints when a user converts ───────────────────────────────────
export async function recordConversionTouchpoints(
  userId: string,
  anonymousId: string | undefined,
  conversionEvent: string,
  revenue: number,
): Promise<void> {
  // Get all events for this anonymous ID + user ID
  const events = await query<{
    channel: string; utm_source: string; utm_medium: string;
    utm_campaign: string; utm_term: string; utm_content: string;
    page_url: string; referrer: string; ts: string;
  }>(`
    SELECT channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
           page_url, referrer, ts
    FROM attribution_events
    WHERE (user_id = $1 OR (anonymous_id = $2 AND $2 IS NOT NULL))
      AND event_name NOT IN ('page_view')
    ORDER BY ts ASC
  `, [userId, anonymousId ?? null]);

  if (events.length === 0) return;

  await withTransaction(async (client) => {
    const first = events[0];
    const last  = events[events.length - 1];

    // First touch
    await client.query(`
      INSERT INTO attribution_touchpoints
        (user_id, type, channel, source, medium, campaign, utm_term, utm_content,
         page_url, referrer, credit, conversion_event, revenue_attributed, ts)
      VALUES ($1,'first',$2,$3,$4,$5,$6,$7,$8,$9,1.0,$10,$11,$12)
    `, [
      userId, first.channel, first.utm_source, first.utm_medium,
      first.utm_campaign, first.utm_term, first.utm_content,
      first.page_url, first.referrer,
      conversionEvent, revenue, first.ts,
    ]);

    // Last touch (skip if same as first)
    if (events.length > 1) {
      await client.query(`
        INSERT INTO attribution_touchpoints
          (user_id, type, channel, source, medium, campaign, utm_term, utm_content,
           page_url, referrer, credit, conversion_event, revenue_attributed, ts)
        VALUES ($1,'last',$2,$3,$4,$5,$6,$7,$8,$9,1.0,$10,$11,$12)
      `, [
        userId, last.channel, last.utm_source, last.utm_medium,
        last.utm_campaign, last.utm_term, last.utm_content,
        last.page_url, last.referrer,
        conversionEvent, revenue, last.ts,
      ]);
    }

    // Linear multi-touch — credit distributed equally to all assisted
    if (events.length > 2) {
      const assisted = events.slice(1, -1);
      const credit   = 1 / assisted.length;
      for (const e of assisted) {
        await client.query(`
          INSERT INTO attribution_touchpoints
            (user_id, type, channel, source, medium, campaign,
             credit, conversion_event, revenue_attributed, ts)
          VALUES ($1,'assisted',$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          userId, e.channel, e.utm_source, e.utm_medium,
          e.utm_campaign, credit, conversionEvent,
          parseFloat(String(revenue)) * credit, e.ts,
        ]);
      }
    }
  });
}

// ── Attribution analytics ─────────────────────────────────────────────────────
export async function getChannelReport(from: Date, to: Date) {
  const [overview] = await query<Record<string, string>>(`
    SELECT
      COUNT(DISTINCT user_id)    AS total_users,
      COUNT(DISTINCT session_id) AS total_sessions,
      COUNT(*)                   AS total_events,
      COUNT(*) FILTER (WHERE event_name = 'signup') AS signups,
      COUNT(*) FILTER (WHERE event_name = 'challenge_purchase') AS purchases
    FROM attribution_events
    WHERE ts BETWEEN $1 AND $2
  `, [from, to]);

  const channelBreakdown = await query<Record<string, string>>(`
    SELECT
      channel,
      COUNT(DISTINCT user_id)    AS users,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) FILTER (WHERE event_name = 'signup')            AS signups,
      COUNT(*) FILTER (WHERE event_name = 'challenge_purchase') AS purchases,
      COALESCE(SUM(revenue_attributed),0)                       AS revenue
    FROM attribution_events ae
    LEFT JOIN attribution_touchpoints at2 ON at2.user_id = ae.user_id
      AND at2.type = 'first'
      AND at2.ts BETWEEN $1 AND $2
    WHERE ae.ts BETWEEN $1 AND $2
    GROUP BY channel ORDER BY users DESC
  `, [from, to]);

  const utmCampaigns = await query<Record<string, string>>(`
    SELECT
      utm_campaign,
      utm_source,
      utm_medium,
      COUNT(DISTINCT user_id) AS users,
      COUNT(*) FILTER (WHERE event_name = 'challenge_purchase') AS conversions,
      COALESCE(SUM(revenue_attributed),0) AS revenue
    FROM attribution_events ae
    LEFT JOIN attribution_touchpoints at2 ON at2.user_id = ae.user_id AND at2.type = 'first'
    WHERE ae.ts BETWEEN $1 AND $2
      AND utm_campaign IS NOT NULL
    GROUP BY utm_campaign, utm_source, utm_medium
    ORDER BY conversions DESC LIMIT 50
  `, [from, to]);

  const trend = await query<Record<string, string>>(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', ts), 'YYYY-MM-DD') AS day,
      channel,
      COUNT(DISTINCT user_id) AS users
    FROM attribution_events
    WHERE ts BETWEEN $1 AND $2
    GROUP BY 1, 2 ORDER BY 1, 2
  `, [from, to]);

  return { overview, channelBreakdown, utmCampaigns, trend };
}

export async function getAttributionStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      (SELECT COUNT(*) FROM attribution_events WHERE ts >= NOW() - INTERVAL '24 hours') AS events_24h,
      (SELECT COUNT(DISTINCT user_id) FROM attribution_events WHERE ts >= DATE_TRUNC('month', NOW())) AS tracked_users_month,
      (SELECT channel FROM attribution_events WHERE ts >= DATE_TRUNC('month', NOW())
        GROUP BY channel ORDER BY COUNT(*) DESC LIMIT 1) AS top_channel,
      (SELECT utm_campaign FROM attribution_events WHERE ts >= DATE_TRUNC('month', NOW())
        AND utm_campaign IS NOT NULL
        GROUP BY utm_campaign ORDER BY COUNT(*) DESC LIMIT 1) AS top_campaign
  `);
  return stats;
}
