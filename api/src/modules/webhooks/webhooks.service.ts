import { createHmac } from 'crypto';
import { query, queryOne, withTransaction } from '../../db/index.js';
import { addWebhookJob } from '../../utils/jobs.js';

// ── Deliver a webhook event to all subscribed endpoints ────────────────────────
export async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await query<{
    id: string; url: string; secret: string; headers: Record<string, string>;
  }>(`
    SELECT id, url, secret, headers
    FROM webhook_endpoints
    WHERE is_active = true
      AND $1 = ANY(events::text[])
  `, [event]);

  for (const ep of endpoints) {
    await addWebhookJob({
      endpointId: ep.id,
      url:        ep.url,
      secret:     ep.secret,
      headers:    ep.headers,
      event,
      payload,
    });
  }
}

// ── Actually deliver (called by BullMQ worker) ────────────────────────────────
export async function deliverWebhook(params: {
  endpointId: string; url: string; secret: string;
  headers: Record<string, string>; event: string;
  payload: Record<string, unknown>; attempt: number;
}): Promise<void> {
  const body      = JSON.stringify({ event: params.event, data: params.payload, ts: Date.now() });
  const signature = createHmac('sha256', params.secret).update(body).digest('hex');

  let statusCode: number | null = null;
  let responseBody = '';
  let error: string | undefined;

  try {
    const res = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type':          'application/json',
        'X-HolaPrime-Signature': `sha256=${signature}`,
        'X-HolaPrime-Event':     params.event,
        ...params.headers,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    statusCode   = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = String(err);
  }

  await query(`
    INSERT INTO webhook_deliveries
      (endpoint_id, event, payload, status_code, response_body, attempt,
       delivered_at, error)
    VALUES ($1,$2,$3,$4,$5,$6,
      CASE WHEN $4 BETWEEN 200 AND 299 THEN NOW() ELSE NULL END,
      $7)
  `, [
    params.endpointId, params.event, JSON.stringify(params.payload),
    statusCode, responseBody, params.attempt, error ?? null,
  ]);

  if (error) throw new Error(error); // triggers BullMQ retry
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function listEndpoints() {
  return query(`
    SELECT we.*,
      (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.endpoint_id = we.id) AS total_deliveries,
      (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.endpoint_id = we.id AND wd.error IS NULL) AS successful
    FROM webhook_endpoints we
    ORDER BY created_at DESC
  `);
}

export async function createEndpoint(data: {
  name: string; url: string; events: string[];
  headers?: Record<string, string>; retryCount?: number;
}, adminId: string): Promise<string> {
  const secret = createHmac('sha256', Date.now().toString())
    .update(data.url + adminId)
    .digest('hex');

  const [ep] = await query<{ id: string }>(`
    INSERT INTO webhook_endpoints
      (name, url, secret, events, headers, retry_count, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [
    data.name, data.url, secret,
    `{${data.events.join(',')}}`,
    JSON.stringify(data.headers ?? {}),
    data.retryCount ?? 3, adminId,
  ]);
  return ep.id;
}

export async function updateEndpoint(
  id: string,
  data: { name?: string; url?: string; events?: string[]; isActive?: boolean },
  adminId: string,
): Promise<void> {
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let i = 1;
  if (data.name     !== undefined) { sets.push(`name = $${i++}`);      vals.push(data.name); }
  if (data.url      !== undefined) { sets.push(`url = $${i++}`);       vals.push(data.url); }
  if (data.events   !== undefined) { sets.push(`events = $${i++}`);    vals.push(`{${data.events.join(',')}}`); }
  if (data.isActive !== undefined) { sets.push(`is_active = $${i++}`); vals.push(data.isActive); }
  await query(`UPDATE webhook_endpoints SET ${sets.join(', ')} WHERE id = $${i}`, [...vals, id]);
}

export async function deleteEndpoint(id: string): Promise<void> {
  await query('DELETE FROM webhook_endpoints WHERE id = $1', [id]);
}

export async function pingEndpoint(id: string): Promise<boolean> {
  const ep = await queryOne<{ url: string; secret: string; headers: Record<string, string> }>(
    'SELECT url, secret, headers FROM webhook_endpoints WHERE id = $1', [id],
  );
  if (!ep) return false;

  const body      = JSON.stringify({ event: 'ping', ts: Date.now() });
  const signature = createHmac('sha256', ep.secret).update(body).digest('hex');

  try {
    const res = await fetch(ep.url, {
      method:  'POST',
      headers: {
        'Content-Type':          'application/json',
        'X-HolaPrime-Signature': `sha256=${signature}`,
        'X-HolaPrime-Event':     'ping',
        ...ep.headers,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    const ok = res.ok;
    await query(
      'UPDATE webhook_endpoints SET last_ping_at = NOW(), last_ping_ok = $1 WHERE id = $2',
      [ok, id],
    );
    return ok;
  } catch {
    await query('UPDATE webhook_endpoints SET last_ping_at = NOW(), last_ping_ok = false WHERE id = $1', [id]);
    return false;
  }
}

export async function getDeliveries(endpointId: string, page = 1, limit = 25) {
  const offset = (page - 1) * limit;
  const [countRow] = await query<{ count: string }>(
    'SELECT COUNT(*) FROM webhook_deliveries WHERE endpoint_id = $1', [endpointId],
  );
  const total = parseInt(countRow?.count ?? '0', 10);
  const deliveries = await query(
    `SELECT * FROM webhook_deliveries WHERE endpoint_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [endpointId, limit, offset],
  );
  return { deliveries, total, page, limit, pages: Math.ceil(total / limit) };
}
