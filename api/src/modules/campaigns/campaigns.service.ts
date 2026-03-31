import { query, queryOne, withTransaction } from '../../db/index.js';
import { config } from '../../config/index.js';
import { addEmailJob } from '../../utils/jobs.js';

// ── Template rendering ────────────────────────────────────────────────────────
export function renderTemplate(html: string, variables: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

// ── Send email via unified dispatcher (Mailmodo → SMTP fallback) ─────────────
export async function sendEmail(params: {
  to: string; subject: string; html: string; text?: string;
}): Promise<{ messageId: string }> {
  const { sendEmail: smtpSend } = await import('../settings/smtp.service.js');
  return smtpSend(params);
}

// ── Campaign management ───────────────────────────────────────────────────────
export async function listCampaigns(params: {
  page: number; limit: number; status?: string; type?: string;
}) {
  const { page, limit, status, type } = params;
  const offset = (page - 1) * limit;
  const conds: string[] = ['1=1'];
  const vals: unknown[] = [];
  let i = 1;

  if (status) { conds.push(`c.status = $${i++}`); vals.push(status); }
  if (type)   { conds.push(`c.type = $${i++}`);   vals.push(type); }

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM campaigns c WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const campaigns = await query(`
    SELECT c.*, et.label AS template_name,
      a.first_name AS creator_first, a.last_name AS creator_last
    FROM campaigns c
    LEFT JOIN email_templates et ON et.id = c.template_id
    LEFT JOIN admin_users a ON a.id = c.created_by
    WHERE ${where}
    ORDER BY c.created_at DESC
    LIMIT $${i} OFFSET $${i+1}
  `, [...vals, limit, offset]);

  return { campaigns, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getCampaignDetail(id: string) {
  const campaign = await queryOne(`
    SELECT c.*, et.html_body, et.subject AS template_subject, et.variables,
      a.first_name AS creator_first, a.last_name AS creator_last
    FROM campaigns c
    LEFT JOIN email_templates et ON et.id = c.template_id
    LEFT JOIN admin_users a ON a.id = c.created_by
    WHERE c.id = $1
  `, [id]);

  if (!campaign) return null;

  const [sendStats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) AS total_sends,
      COUNT(*) FILTER (WHERE status = 'delivered')   AS delivered,
      COUNT(*) FILTER (WHERE status = 'opened')      AS opened,
      COUNT(*) FILTER (WHERE status = 'clicked')     AS clicked,
      COUNT(*) FILTER (WHERE status = 'bounced')     AS bounced,
      COUNT(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribed
    FROM campaign_sends WHERE campaign_id = $1
  `, [id]);

  return { ...campaign, sendStats };
}

export async function createCampaign(data: {
  name: string; type: string; templateId?: string;
  segmentQuery?: Record<string, unknown>; scheduledAt?: string;
  adminId: string;
}): Promise<string> {
  const [c] = await query<{ id: string }>(`
    INSERT INTO campaigns (name, type, status, template_id, segment_query, scheduled_at, created_by)
    VALUES ($1,$2,'draft',$3,$4,$5,$6)
    RETURNING id
  `, [
    data.name, data.type, data.templateId,
    JSON.stringify(data.segmentQuery ?? {}),
    data.scheduledAt, data.adminId,
  ]);
  return c.id;
}

// ── Launch a campaign — queues sends for every matching contact ───────────────
export async function launchCampaign(campaignId: string, adminId: string): Promise<number> {
  const campaign = await queryOne<{
    id: string; name: string; type: string; template_id: string;
    segment_query: Record<string, unknown>; status: string;
  }>('SELECT * FROM campaigns WHERE id = $1', [campaignId]);

  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    throw new Error('Campaign is not in a launchable state');
  }

  if (campaign.type === 'email') {
    return launchEmailCampaign(campaign, adminId);
  }

  throw new Error(`Campaign type '${campaign.type}' is not yet supported for bulk launch`);
}

async function launchEmailCampaign(
  campaign: { id: string; name: string; template_id: string },
  adminId: string,
): Promise<number> {
  const template = await queryOne<{
    subject: string; html_body: string; text_body: string;
  }>('SELECT * FROM email_templates WHERE id = $1', [campaign.template_id]);

  if (!template) throw new Error('Template not found');

  // Get all subscribed contacts
  const contacts = await query<{ id: string; email: string; first_name: string; last_name: string }>(`
    SELECT c.id, c.email, c.first_name, c.last_name
    FROM crm_contacts c
    WHERE c.status NOT IN ('lost','unsubscribed')
      AND c.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type IN ('all','marketing'))
    LIMIT 50000
  `);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE campaigns SET status = 'running', started_at = NOW() WHERE id = $1`,
      [campaign.id],
    );
  });

  // Queue all sends
  for (const contact of contacts) {
    await emailQueue.add('send', {
      campaignId:  campaign.id,
      contactId:   contact.id,
      to:          contact.email,
      subject:     renderTemplate(template.subject, { first_name: contact.first_name ?? '', last_name: contact.last_name ?? '' }),
      html:        renderTemplate(template.html_body, { first_name: contact.first_name ?? '', last_name: contact.last_name ?? '' }),
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
  }

  return contacts.length;
}

// ── Email templates ───────────────────────────────────────────────────────────
export async function listTemplates(_category?: string) {
  return query(
    `SELECT id, key, label AS name, subject, enabled AS is_active, updated_at
     FROM email_templates ORDER BY label`,
  );
}

export async function getTemplate(id: string) {
  return queryOne('SELECT * FROM email_templates WHERE id=$1 OR key=$1', [id]);
}

export async function upsertTemplate(data: {
  id?: string; name: string; slug?: string; key?: string;
  label?: string; subject: string;
  htmlBody: string; textBody?: string;
  variables?: string[];
  adminId: string;
}) {
  const label = data.label ?? data.name;
  const key   = (data.key ?? data.slug ?? label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')).slice(0, 60);
  if (data.id) {
    await query(
      `UPDATE email_templates
       SET label=$1, subject=$2, html_body=$3, text_body=$4, variables=$5, updated_at=NOW()
       WHERE id=$6`,
      [label, data.subject, data.htmlBody, data.textBody ?? null,
       JSON.stringify(data.variables ?? []), data.id]
    );
    return data.id;
  }
  const [t] = await query<{ id: string }>(
    `INSERT INTO email_templates (key, label, subject, html_body, text_body, variables)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [key, label, data.subject, data.htmlBody, data.textBody ?? null,
     JSON.stringify(data.variables ?? [])]
  );
  return t.id;
}

export async function getCampaignStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*)                                                       AS total_campaigns,
      COUNT(*) FILTER (WHERE status = 'running')                    AS running,
      COUNT(*) FILTER (WHERE status = 'completed')                  AS completed,
      COUNT(*) FILTER (WHERE status = 'draft')                      AS draft,
      COALESCE(SUM(sent_count),0)                                   AS total_sent,
      COALESCE(SUM(open_count),0)                                   AS total_opens,
      COALESCE(SUM(click_count),0)                                  AS total_clicks,
      CASE WHEN SUM(sent_count) > 0
           THEN ROUND(SUM(open_count)::NUMERIC / SUM(sent_count) * 100, 1)
           ELSE 0 END                                                AS avg_open_rate
    FROM campaigns WHERE type = 'email'
  `);
  return stats;
}
