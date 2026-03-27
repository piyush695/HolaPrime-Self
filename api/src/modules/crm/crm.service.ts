import { query, queryOne, withTransaction } from '../../db/index.js';

// ── Lead Score Engine ─────────────────────────────────────────────────────────
// Score rules: 0-100 composite
const SCORE_RULES = {
  has_phone:         10,
  kyc_submitted:     15,
  kyc_approved:      25,
  account_created:   20,
  first_deposit:     30,
  multiple_accounts: 10,
  email_opened:       5,
  wa_replied:        10,
  recent_activity:   10, // activity within 7 days
};

export async function computeLeadScore(contactId: string): Promise<number> {
  const data = await queryOne<Record<string, unknown>>(`
    SELECT
      c.phone IS NOT NULL                                        AS has_phone,
      u.kyc_status = 'approved'                                 AS kyc_approved,
      u.kyc_status IN ('pending','under_review','approved')     AS kyc_submitted,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.user_id = u.id) > 0 AS account_created,
      (SELECT COUNT(*) FROM payments p WHERE p.user_id = u.id AND p.type='challenge_fee' AND p.status='completed') > 0 AS first_deposit,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.user_id = u.id) > 1 AS multiple_accounts,
      (SELECT MAX(created_at) FROM crm_activities ca WHERE ca.contact_id = c.id) > NOW() - INTERVAL '7 days' AS recent_activity
    FROM crm_contacts c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = $1
  `, [contactId]);

  if (!data) return 0;

  let score = 0;
  if (data.has_phone)         score += SCORE_RULES.has_phone;
  if (data.kyc_submitted)     score += SCORE_RULES.kyc_submitted;
  if (data.kyc_approved)      score += SCORE_RULES.kyc_approved - SCORE_RULES.kyc_submitted;
  if (data.account_created)   score += SCORE_RULES.account_created;
  if (data.first_deposit)     score += SCORE_RULES.first_deposit;
  if (data.multiple_accounts) score += SCORE_RULES.multiple_accounts;
  if (data.recent_activity)   score += SCORE_RULES.recent_activity;

  return Math.min(100, score);
}

// ── List contacts ─────────────────────────────────────────────────────────────
export async function listContacts(params: {
  page: number; limit: number;
  search?: string; status?: string; source?: string;
  assignedTo?: string; minScore?: number; tags?: string[];
}) {
  const { page, limit, search, status, source, assignedTo, minScore, tags } = params;
  const offset = (page - 1) * limit;
  const conds: string[] = ['1=1'];
  const vals: unknown[] = [];
  let i = 1;

  if (search)     { conds.push(`(c.email ILIKE $${i} OR (c.first_name || ' ' || COALESCE(c.last_name,'')) ILIKE $${i} OR c.phone ILIKE $${i})`); vals.push(`%${search}%`); i++; }
  if (status)     { conds.push(`c.status = $${i++}`);      vals.push(status); }
  if (source)     { conds.push(`c.source = $${i++}`);      vals.push(source); }
  if (assignedTo) { conds.push(`c.assigned_to = $${i++}`); vals.push(assignedTo); }
  if (minScore)   { conds.push(`c.score >= $${i++}`);      vals.push(minScore); }
  if (tags?.length) { conds.push(`c.tags @> $${i++}`);     vals.push(tags); }

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM crm_contacts c WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const contacts = await query(`
    SELECT c.*,
      u.status AS user_status, u.kyc_status,
      a.first_name AS assignee_first, a.last_name AS assignee_last,
      (SELECT COUNT(*) FROM crm_activities ca WHERE ca.contact_id = c.id) AS activity_count,
      (SELECT MAX(ca.created_at) FROM crm_activities ca WHERE ca.contact_id = c.id) AS last_activity_at
    FROM crm_contacts c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN admin_users a ON a.id = c.assigned_to
    WHERE ${where}
    ORDER BY c.score DESC, c.created_at DESC
    LIMIT $${i} OFFSET $${i+1}
  `, [...vals, limit, offset]);

  return { contacts, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getContact(id: string) {
  const contact = await queryOne(`
    SELECT c.*,
      u.status AS user_status, u.kyc_status, u.created_at AS user_since,
      a.first_name AS assignee_first, a.last_name AS assignee_last,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.user_id = c.user_id) AS account_count,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.user_id = c.user_id AND p.type='challenge_fee' AND p.status='completed') AS total_spent
    FROM crm_contacts c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN admin_users a ON a.id = c.assigned_to
    WHERE c.id = $1
  `, [id]);

  if (!contact) return null;

  const activities = await query(
    `SELECT ca.*, a.first_name AS admin_first, a.last_name AS admin_last
     FROM crm_activities ca
     LEFT JOIN admin_users a ON a.id = ca.admin_id
     WHERE ca.contact_id = $1
     ORDER BY ca.created_at DESC LIMIT 50`,
    [id],
  );

  const notes = await query(
    `SELECT cn.*, a.first_name AS author_first, a.last_name AS author_last
     FROM crm_notes cn
     LEFT JOIN admin_users a ON a.id = cn.author_id
     WHERE cn.contact_id = $1
     ORDER BY cn.is_pinned DESC, cn.created_at DESC`,
    [id],
  );

  return { ...contact, activities, notes };
}

export async function upsertContact(data: {
  email: string; firstName?: string; lastName?: string;
  phone?: string; countryCode?: string; source?: string;
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
  utmTerm?: string; utmContent?: string;
  firstTouchUrl?: string; affiliateId?: string;
  userId?: string;
}): Promise<string> {
  const [existing] = await query<{ id: string }>(
    'SELECT id FROM crm_contacts WHERE email = $1', [data.email],
  );

  if (existing) {
    await query(`
      UPDATE crm_contacts
      SET first_name   = COALESCE($2, first_name),
          last_name    = COALESCE($3, last_name),
          phone        = COALESCE($4, phone),
          user_id      = COALESCE($5, user_id),
          last_activity_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [existing.id, data.firstName, data.lastName, data.phone, data.userId]);
    return existing.id;
  }

  const [created] = await query<{ id: string }>(`
    INSERT INTO crm_contacts
      (email, first_name, last_name, phone, country_code, source,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       first_touch_url, affiliate_id, user_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING id
  `, [
    data.email, data.firstName, data.lastName, data.phone,
    data.countryCode, data.source ?? 'unknown',
    data.utmSource, data.utmMedium, data.utmCampaign,
    data.utmTerm, data.utmContent,
    data.firstTouchUrl, data.affiliateId, data.userId,
  ]);

  return created.id;
}

export async function addActivity(params: {
  contactId: string; adminId?: string; userId?: string;
  type: string; subject?: string; body?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`
      INSERT INTO crm_activities (contact_id, admin_id, user_id, type, subject, body, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [
      params.contactId, params.adminId, params.userId,
      params.type, params.subject, params.body,
      JSON.stringify(params.metadata ?? {}),
    ]);

    await client.query(
      `UPDATE crm_contacts SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [params.contactId],
    );
  });
}

export async function addNote(params: {
  contactId: string; authorId: string; body: string; isPinned?: boolean;
}): Promise<void> {
  await query(`
    INSERT INTO crm_notes (contact_id, author_id, body, is_pinned)
    VALUES ($1,$2,$3,$4)
  `, [params.contactId, params.authorId, params.body, params.isPinned ?? false]);

  await addActivity({
    contactId: params.contactId, adminId: params.authorId,
    type: 'note', body: params.body.slice(0, 140),
  });
}

export async function updateContactStatus(id: string, status: string, adminId: string): Promise<void> {
  const prev = await queryOne<{ status: string }>('SELECT status FROM crm_contacts WHERE id = $1', [id]);
  await query('UPDATE crm_contacts SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
  await addActivity({
    contactId: id, adminId,
    type: 'status_change',
    subject: `Status changed: ${prev?.status} → ${status}`,
  });
}

export async function assignContact(id: string, adminId: string, assigneeId: string): Promise<void> {
  await query('UPDATE crm_contacts SET assigned_to = $1, updated_at = NOW() WHERE id = $2', [assigneeId, id]);
  await addActivity({ contactId: id, adminId, type: 'note', subject: `Assigned to admin ${assigneeId}` });
}

export async function refreshAllScores(): Promise<void> {
  const contacts = await query<{ id: string }>('SELECT id FROM crm_contacts');
  for (const c of contacts) {
    const score = await computeLeadScore(c.id);
    await query('UPDATE crm_contacts SET score = $1 WHERE id = $2', [score, c.id]);
  }
}

export async function getCRMStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*)                                                   AS total_contacts,
      COUNT(*) FILTER (WHERE status = 'new')                    AS new_leads,
      COUNT(*) FILTER (WHERE status = 'contacted')              AS contacted,
      COUNT(*) FILTER (WHERE status = 'qualified')              AS qualified,
      COUNT(*) FILTER (WHERE status = 'converted')              AS converted,
      COUNT(*) FILTER (WHERE status = 'lost')                   AS lost,
      AVG(score)::NUMERIC(5,1)                                  AS avg_score,
      COUNT(*) FILTER (WHERE score >= 70)                       AS hot_leads,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) AS new_this_month
    FROM crm_contacts
  `);

  const sourceBreakdown = await query<{ source: string; count: string }>(`
    SELECT source, COUNT(*) AS count
    FROM crm_contacts
    GROUP BY source ORDER BY count DESC
  `);

  const conversionFunnel = await query<{ status: string; count: string }>(`
    SELECT status, COUNT(*) AS count
    FROM crm_contacts
    GROUP BY status ORDER BY count DESC
  `);

  return { stats, sourceBreakdown, conversionFunnel };
}
