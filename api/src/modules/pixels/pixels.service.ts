import { query, queryOne } from '../../db/index.js';

// ── List all pixels ───────────────────────────────────────────────────────────
export async function listPixels() {
  return query(`
    SELECT p.*, a.email AS created_by_email
    FROM pixel_configs p
    LEFT JOIN admin_users a ON a.id = p.created_by
    ORDER BY p.created_at DESC
  `);
}

// ── Get single pixel ──────────────────────────────────────────────────────────
export async function getPixel(id: string) {
  return queryOne(`SELECT * FROM pixel_configs WHERE id = $1`, [id]);
}

// ── Get all active pixels (public endpoint for trader app) ───────────────────
export async function getActivePixels(page?: string) {
  const rows = await query<any>(`
    SELECT id, name, platform, pixel_id, extra_config, custom_script,
           load_on, fire_on_events, event_map
    FROM pixel_configs
    WHERE is_active = true
  `);

  // Filter by page scope
  if (page) {
    return rows.filter((r: any) =>
      r.load_on.includes('all') || r.load_on.includes(page)
    );
  }
  return rows;
}

// ── Create pixel ──────────────────────────────────────────────────────────────
export async function createPixel(data: {
  name: string;
  platform: string;
  pixelId?: string;
  extraConfig?: Record<string, unknown>;
  customScript?: string;
  loadOn?: string[];
  isActive?: boolean;
  fireOnEvents?: string[];
  eventMap?: Record<string, string>;
  createdBy?: string;
}): Promise<string> {
  const [row] = await query<{ id: string }>(`
    INSERT INTO pixel_configs
      (name, platform, pixel_id, extra_config, custom_script,
       load_on, is_active, fire_on_events, event_map, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id
  `, [
    data.name, data.platform, data.pixelId ?? null,
    JSON.stringify(data.extraConfig ?? {}),
    data.customScript ?? null,
    data.loadOn ?? ['all'],
    data.isActive ?? false,
    data.fireOnEvents ?? [],
    JSON.stringify(data.eventMap ?? {}),
    data.createdBy ?? null,
  ]);
  return row.id;
}

// ── Update pixel ──────────────────────────────────────────────────────────────
export async function updatePixel(id: string, data: Partial<{
  name: string;
  pixelId: string;
  extraConfig: Record<string, unknown>;
  customScript: string;
  loadOn: string[];
  isActive: boolean;
  fireOnEvents: string[];
  eventMap: Record<string, string>;
}>) {
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let i = 1;

  if (data.name        !== undefined) { sets.push(`name = $${i++}`);            vals.push(data.name); }
  if (data.pixelId     !== undefined) { sets.push(`pixel_id = $${i++}`);        vals.push(data.pixelId); }
  if (data.extraConfig !== undefined) { sets.push(`extra_config = $${i++}`);    vals.push(JSON.stringify(data.extraConfig)); }
  if (data.customScript!== undefined) { sets.push(`custom_script = $${i++}`);   vals.push(data.customScript); }
  if (data.loadOn      !== undefined) { sets.push(`load_on = $${i++}`);         vals.push(data.loadOn); }
  if (data.isActive    !== undefined) { sets.push(`is_active = $${i++}`);       vals.push(data.isActive); }
  if (data.fireOnEvents!== undefined) { sets.push(`fire_on_events = $${i++}`);  vals.push(data.fireOnEvents); }
  if (data.eventMap    !== undefined) { sets.push(`event_map = $${i++}`);       vals.push(JSON.stringify(data.eventMap)); }

  vals.push(id);
  await query(`UPDATE pixel_configs SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

// ── Delete pixel ──────────────────────────────────────────────────────────────
export async function deletePixel(id: string) {
  await query(`DELETE FROM pixel_configs WHERE id = $1`, [id]);
}

// ── S2S event params ──────────────────────────────────────────────────────────
export async function getEventParams(integrationId: string) {
  return query(`
    SELECT * FROM s2s_event_params
    WHERE integration_id = $1
    ORDER BY internal_event
  `, [integrationId]);
}

export async function upsertEventParam(data: {
  integrationId: string;
  internalEvent: string;
  externalEvent: string;
  params: Record<string, unknown>;
  enabled?: boolean;
}) {
  await query(`
    INSERT INTO s2s_event_params
      (integration_id, internal_event, external_event, params, enabled)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (integration_id, internal_event) DO UPDATE
    SET external_event = $3, params = $4, enabled = $5, updated_at = NOW()
  `, [
    data.integrationId, data.internalEvent, data.externalEvent,
    JSON.stringify(data.params), data.enabled ?? true,
  ]);
}

export async function deleteEventParam(integrationId: string, internalEvent: string) {
  await query(`
    DELETE FROM s2s_event_params
    WHERE integration_id = $1 AND internal_event = $2
  `, [integrationId, internalEvent]);
}

// ── Get resolved event params for firing (used by event-bus) ─────────────────
export async function getResolvedEventParams(integrationId: string, internalEvent: string) {
  return queryOne<{
    external_event: string;
    params: Record<string, unknown>;
    enabled: boolean;
  }>(`
    SELECT external_event, params, enabled
    FROM s2s_event_params
    WHERE integration_id = $1 AND internal_event = $2
  `, [integrationId, internalEvent]);
}
