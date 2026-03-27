import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';
import crypto from 'crypto';

function genShortCode() {
  return crypto.randomBytes(4).toString('hex'); // 8-char hex code
}

function buildUTMUrl(data: any): string {
  const url = new URL(data.destination_url);
  const params: Record<string, string> = {
    utm_source:   data.utm_source,
    utm_medium:   data.utm_medium,
    utm_campaign: data.utm_campaign,
  };
  if (data.utm_term)    params.utm_term    = data.utm_term;
  if (data.utm_content) params.utm_content = data.utm_content;
  if (data.utm_id)      params.utm_id      = data.utm_id;
  // Custom params
  const custom = typeof data.custom_params === 'object' ? data.custom_params : {};
  for (const [k, v] of Object.entries(custom)) {
    if (k && v) params[k] = String(v);
  }
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function utmRoutes(app: FastifyInstance) {
  // ── Public: redirect short link + record click ────────────────────────────
  app.get('/go/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const link = await queryOne<any>('SELECT * FROM utm_links WHERE short_code=$1 AND is_active=true', [code]);
    if (!link) return reply.status(404).send('Link not found');

    // Generate click ID
    const clickId = 'hp_' + crypto.randomBytes(8).toString('hex');
    const ip = req.ip ?? '127.0.0.1';
    const ua = req.headers['user-agent'] ?? '';
    const channel = deriveChannel(link.utm_source, link.utm_medium);

    await query(
      `INSERT INTO ad_clicks (click_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
        landing_url, channel, device_type, ip_address, user_agent, utm_link_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::inet,$12,$13)`,
      [clickId, link.utm_source, link.utm_medium, link.utm_campaign,
       link.utm_term ?? null, link.utm_content ?? null, link.utm_id ?? null,
       buildUTMUrl(link), channel,
       /mobile/i.test(ua) ? 'mobile' : 'desktop',
       ip.length <= 45 ? ip : '127.0.0.1', ua.slice(0, 500), link.id]
    ).catch(() => {});

    await query('UPDATE utm_links SET total_clicks=total_clicks+1, updated_at=NOW() WHERE id=$1', [link.id]).catch(() => {});

    // Redirect with click_id appended
    const dest = new URL(buildUTMUrl(link));
    dest.searchParams.set('hp_click_id', clickId);
    return reply.redirect(dest.toString());
  });

  // ── Admin auth ─────────────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/go/')) return;
    return app.authenticate(req, reply);
  });

  // GET all links
  app.get('/', async (req, reply) => {
    const { search, source, active } = req.query as any;
    let where = 'WHERE 1=1';
    const vals: any[] = [];
    if (search)        { vals.push(`%${search}%`); where += ` AND (name ILIKE $${vals.length} OR utm_campaign ILIKE $${vals.length})`; }
    if (source)        { vals.push(source);        where += ` AND utm_source=$${vals.length}`; }
    if (active !== undefined) { vals.push(active === 'true'); where += ` AND is_active=$${vals.length}`; }
    const rows = await query(`SELECT * FROM utm_links ${where} ORDER BY created_at DESC`, vals);
    // Add full URL to each
    return reply.send((rows as any[]).map(r => ({ ...r, full_url: buildUTMUrl(r) })));
  });

  // POST create link
  app.post('/', async (req, reply) => {
    const data = req.body as any;
    const admin = (req as any).admin;
    const shortCode = data.short_code || genShortCode();
    const row = await queryOne<any>(
      `INSERT INTO utm_links (name, destination_url, utm_source, utm_medium, utm_campaign, utm_term,
        utm_content, utm_id, custom_params, short_code, tags, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [data.name, data.destination_url, data.utm_source, data.utm_medium, data.utm_campaign,
       data.utm_term ?? null, data.utm_content ?? null, data.utm_id ?? null,
       JSON.stringify(data.custom_params ?? {}), shortCode,
       JSON.stringify(data.tags ?? []), data.notes ?? null, admin.id]
    );
    return reply.status(201).send({ ...row, full_url: buildUTMUrl(row) });
  });

  // PATCH update link
  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    await query(
      `UPDATE utm_links SET name=$1, utm_source=$2, utm_medium=$3, utm_campaign=$4,
        utm_term=$5, utm_content=$6, utm_id=$7, custom_params=$8, tags=$9, notes=$10,
        is_active=$11, updated_at=NOW() WHERE id=$12`,
      [data.name, data.utm_source, data.utm_medium, data.utm_campaign,
       data.utm_term ?? null, data.utm_content ?? null, data.utm_id ?? null,
       JSON.stringify(data.custom_params ?? {}), JSON.stringify(data.tags ?? []),
       data.notes ?? null, data.is_active ?? true, id]
    );
    return reply.send({ ok: true });
  });

  // DELETE (deactivate)
  app.delete('/:id', async (req, reply) => {
    await query('UPDATE utm_links SET is_active=false WHERE id=$1', [(req.params as any).id]);
    return reply.send({ ok: true });
  });

  // GET click analytics for a link
  app.get('/:id/clicks', async (req, reply) => {
    const { id } = req.params as { id: string };
    const clicks = await query(
      `SELECT click_id, channel, device_type, country_code, conversion_event,
        conversion_value, converted_at, created_at
       FROM ad_clicks WHERE utm_link_id=$1 ORDER BY created_at DESC LIMIT 500`,
      [id]
    );
    const stats = await queryOne<any>(
      `SELECT COUNT(*) as total, COUNT(user_id) as conversions,
        COUNT(DISTINCT country_code) as countries,
        COALESCE(SUM(conversion_value),0) as revenue
       FROM ad_clicks WHERE utm_link_id=$1`, [id]
    );
    return reply.send({ clicks, stats });
  });

  // GET all click IDs with filters
  app.get('/clicks', async (req, reply) => {
    const { channel, from, to, limit = 100 } = req.query as any;
    let where = 'WHERE 1=1';
    const vals: any[] = [];
    if (channel) { vals.push(channel); where += ` AND channel=$${vals.length}`; }
    if (from)    { vals.push(from);    where += ` AND created_at >= $${vals.length}`; }
    if (to)      { vals.push(to);      where += ` AND created_at <= $${vals.length}`; }
    vals.push(parseInt(limit));
    const rows = await query(
      `SELECT ac.*, u.email, u.first_name, u.last_name
       FROM ad_clicks ac LEFT JOIN users u ON u.id=ac.user_id
       ${where} ORDER BY ac.created_at DESC LIMIT $${vals.length}`,
      vals
    );
    return reply.send(rows);
  });

  // GET campaign list
  app.get('/campaigns', async (_req, reply) => {
    const rows = await query('SELECT * FROM marketing_campaigns ORDER BY created_at DESC');
    return reply.send(rows);
  });

  app.post('/campaigns', async (req, reply) => {
    const data = req.body as any;
    const admin = (req as any).admin;
    const row = await queryOne(
      `INSERT INTO marketing_campaigns (name, platform, utm_campaign, budget, status, start_date, end_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [data.name, data.platform, data.utm_campaign ?? null, data.budget ?? null,
       data.status ?? 'active', data.start_date ?? null, data.end_date ?? null,
       data.notes ?? null, admin.id]
    );
    return reply.status(201).send(row);
  });

  app.patch('/campaigns/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { spend, impressions, clicks, conversions, revenue, status, notes } = req.body as any;
    await query(
      `UPDATE marketing_campaigns SET spend=COALESCE($1,spend), impressions=COALESCE($2,impressions),
        clicks=COALESCE($3,clicks), conversions=COALESCE($4,conversions), revenue=COALESCE($5,revenue),
        status=COALESCE($6,status), notes=COALESCE($7,notes), updated_at=NOW() WHERE id=$8`,
      [spend, impressions, clicks, conversions, revenue, status, notes, id]
    );
    return reply.send({ ok: true });
  });

  // POST: record external click (from landing page JS tracker)
  app.post('/record-click', async (req, reply) => {
    const data = req.body as any;
    const clickId = 'hp_' + crypto.randomBytes(8).toString('hex');
    const ip = req.ip ?? '127.0.0.1';
    const ua = req.headers['user-agent'] ?? '';
    const channel = deriveChannel(data.utm_source, data.utm_medium, data.gclid, data.fbclid, data.ttclid);

    await query(
      `INSERT INTO ad_clicks (click_id, gclid, fbclid, ttclid, twclid, msclkid, li_fat_id,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
        landing_url, referrer, channel, device_type, country_code, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::inet,$20)
       ON CONFLICT (click_id) DO NOTHING`,
      [clickId, data.gclid??null, data.fbclid??null, data.ttclid??null,
       data.twclid??null, data.msclkid??null, data.li_fat_id??null,
       data.utm_source??null, data.utm_medium??null, data.utm_campaign??null,
       data.utm_term??null, data.utm_content??null, data.utm_id??null,
       data.url??null, data.referrer??null, channel,
       /mobile/i.test(ua)?'mobile':'desktop',
       data.country_code??null,
       ip.length<=45?ip:'127.0.0.1', ua.slice(0,500)]
    ).catch(()=>{});

    return reply.send({ click_id: clickId });
  });

  // POST: attribute a click to a user (called on registration)
  app.post('/attribute', async (req, reply) => {
    const { click_id, user_id, event, value } = req.body as any;
    if (!click_id || !user_id) return reply.status(400).send({ error: 'click_id and user_id required' });

    await query(
      `UPDATE ad_clicks SET user_id=$1, converted_at=NOW(), conversion_event=$2, conversion_value=$3
       WHERE click_id=$4`,
      [user_id, event ?? 'signup', value ?? null, click_id]
    );
    await query(
      `UPDATE users SET first_click_id=COALESCE(first_click_id,$1), last_click_id=$1 WHERE id=$2`,
      [click_id, user_id]
    );
    return reply.send({ ok: true });
  });
}

function deriveChannel(source?: string, medium?: string, gclid?: string, fbclid?: string, ttclid?: string): string {
  if (gclid)  return 'google_ads';
  if (fbclid) return 'meta_ads';
  if (ttclid) return 'tiktok_ads';
  if (!source) return 'direct';
  const s = source.toLowerCase();
  const m = (medium ?? '').toLowerCase();
  if (s.includes('google') && m.includes('cpc')) return 'google_ads';
  if (s.includes('facebook') || s.includes('instagram') || s.includes('meta')) return 'meta_ads';
  if (s.includes('tiktok')) return 'tiktok_ads';
  if (s.includes('twitter') || s.includes('x.com')) return 'twitter_ads';
  if (s.includes('linkedin')) return 'linkedin_ads';
  if (s.includes('bing') || s.includes('microsoft')) return 'bing_ads';
  if (m === 'email') return 'email';
  if (m === 'affiliate') return 'affiliate';
  if (m === 'organic' || m === 'seo') return 'organic';
  if (m === 'social') return 'organic_social';
  return 'paid_other';
}
