import { query, queryOne, withTransaction } from '../../db/index.js';
import { config } from '../../config/index.js';

const WA_BASE = 'https://graph.facebook.com/v19.0';

// ── Meta Cloud API calls ──────────────────────────────────────────────────────
async function waRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${WA_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.whatsapp.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Send a template message ───────────────────────────────────────────────────
export async function sendTemplateMessage(params: {
  phone:       string;
  templateId:  string;
  variables:   Record<string, string>;
  contactId?:  string;
  userId?:     string;
  campaignId?: string;
}): Promise<string> {
  const template = await queryOne<{
    wa_template_name: string; language: string;
    body_text: string; header_type: string; variables: string[];
  }>('SELECT * FROM whatsapp_templates WHERE id = $1 AND status = $2', [
    params.templateId, 'approved',
  ]);

  if (!template) throw new Error('Template not found or not approved');

  // Build components from variables
  const bodyComponents: Array<{ type: string; parameters: Array<{ type: string; text: string }> }> = [];
  if (Object.keys(params.variables).length > 0) {
    bodyComponents.push({
      type: 'body',
      parameters: Object.values(params.variables).map(v => ({ type: 'text', text: v })),
    });
  }

  const waRes = await waRequest<{
    messages: Array<{ id: string }>;
  }>(`/${config.whatsapp.phoneId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                params.phone.replace(/\D/g, ''),
    type:              'template',
    template: {
      name:       template.wa_template_name,
      language:   { code: template.language },
      components: bodyComponents,
    },
  });

  const waMessageId = waRes.messages[0]?.id;

  const [msg] = await query<{ id: string }>(`
    INSERT INTO whatsapp_messages
      (campaign_id, contact_id, user_id, phone, template_id,
       direction, status, wa_message_id, variables_used, sent_at)
    VALUES ($1,$2,$3,$4,$5,'outbound','sent',$6,$7,NOW())
    RETURNING id
  `, [
    params.campaignId, params.contactId, params.userId,
    params.phone, params.templateId,
    waMessageId, JSON.stringify(params.variables),
  ]);

  return msg.id;
}

// ── Send a free-form text message (within 24h customer window) ────────────────
export async function sendTextMessage(params: {
  phone: string; body: string;
  contactId?: string; conversationId?: string;
  adminId?: string;
}): Promise<void> {
  await waRequest(`/${config.whatsapp.phoneId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                params.phone.replace(/\D/g, ''),
    type:              'text',
    text:              { body: params.body, preview_url: false },
  });

  await query(`
    INSERT INTO whatsapp_messages
      (contact_id, phone, direction, status, body, sent_at)
    VALUES ($1,$2,'outbound','sent',$3,NOW())
  `, [params.contactId, params.phone, params.body]);

  if (params.conversationId) {
    await query(
      'UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE id = $1',
      [params.conversationId],
    );
  }
}

// ── Webhook handler (inbound messages + status updates) ──────────────────────
export async function handleWebhook(payload: Record<string, unknown>): Promise<void> {
  const entry = (payload.entry as any[])?.[0];
  const changes = entry?.changes?.[0]?.value;
  if (!changes) return;

  // Status updates
  for (const status of changes.statuses ?? []) {
    await query(`
      UPDATE whatsapp_messages
      SET status      = $1,
          delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END,
          read_at      = CASE WHEN $1 = 'read' THEN NOW() ELSE read_at END
      WHERE wa_message_id = $2
    `, [status.status, status.id]);
  }

  // Inbound messages
  for (const msg of changes.messages ?? []) {
    const phone = msg.from;

    // Find or create contact
    let contact = await queryOne<{ id: string }>(
      'SELECT id FROM crm_contacts WHERE phone = $1', [phone],
    );

    if (!contact) {
      const profileName = changes.contacts?.[0]?.profile?.name;
      const [newContact] = await query<{ id: string }>(`
        INSERT INTO crm_contacts (phone, first_name, source)
        VALUES ($1, $2, 'whatsapp') RETURNING id
      `, [phone, profileName]);
      contact = newContact;
    }

    const body = msg.type === 'text' ? msg.text?.body : `[${msg.type}]`;

    await withTransaction(async (client) => {
      await client.query(`
        INSERT INTO whatsapp_messages
          (contact_id, phone, direction, status, body, wa_message_id, sent_at)
        VALUES ($1,$2,'inbound','delivered',$3,$4,NOW())
      `, [contact!.id, phone, body, msg.id]);

      // Update or create conversation
      const conv = await client.query(
        'SELECT id FROM whatsapp_conversations WHERE phone = $1 AND status = $2',
        [phone, 'open'],
      );

      if (conv.rows.length === 0) {
        await client.query(`
          INSERT INTO whatsapp_conversations (contact_id, phone, status, last_message_at)
          VALUES ($1,$2,'open',NOW())
        `, [contact!.id, phone]);
      } else {
        await client.query(
          'UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE id = $1',
          [conv.rows[0].id],
        );
      }
    });
  }
}

// ── Template management ───────────────────────────────────────────────────────
export async function listTemplates() {
  return query('SELECT * FROM whatsapp_templates ORDER BY created_at DESC');
}

export async function getConversations(params: { page: number; limit: number; status?: string }) {
  const { page, limit, status } = params;
  const offset = (page - 1) * limit;
  const where  = status ? 'WHERE wc.status = $1' : '';
  const vals   = status ? [status] : [];

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM whatsapp_conversations wc ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const conversations = await query(`
    SELECT wc.*,
      c.first_name, c.last_name, c.email,
      a.first_name AS assignee_first, a.last_name AS assignee_last,
      (SELECT body FROM whatsapp_messages
        WHERE phone = wc.phone ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM whatsapp_conversations wc
    LEFT JOIN crm_contacts c ON c.id = wc.contact_id
    LEFT JOIN admin_users a  ON a.id = wc.assigned_to
    ${where}
    ORDER BY wc.last_message_at DESC NULLS LAST
    LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
  `, [...vals, limit, offset]);

  return { conversations, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getConversationMessages(conversationId: string) {
  const conv = await queryOne(
    'SELECT * FROM whatsapp_conversations WHERE id = $1', [conversationId],
  );
  if (!conv) return null;

  const messages = await query(`
    SELECT * FROM whatsapp_messages WHERE phone = $1
    ORDER BY created_at ASC LIMIT 100
  `, [(conv as any).phone]);

  return { ...conv, messages };
}

export async function getWAStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      (SELECT COUNT(*) FROM whatsapp_conversations WHERE status = 'open')  AS open_conversations,
      (SELECT COUNT(*) FROM whatsapp_messages WHERE direction = 'outbound' AND created_at >= DATE_TRUNC('month', NOW())) AS sent_this_month,
      (SELECT COUNT(*) FROM whatsapp_messages WHERE status = 'read' AND created_at >= DATE_TRUNC('month', NOW())) AS read_this_month,
      (SELECT COUNT(*) FROM whatsapp_templates WHERE status = 'approved') AS approved_templates
  `);
  return stats;
}
