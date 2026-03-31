/**
 * SendGrid service — transactional emails via SendGrid Web API.
 * Used for: OTP, admin invites, password reset, account events, KYC, system alerts.
 *
 * Uses the SendGrid Web API directly (not SMTP) for better delivery tracking,
 * suppression management, and template support.
 */

const BASE = 'https://api.sendgrid.com/v3';

export interface SendGridEmailParams {
  to:           string | string[];
  subject:      string;
  html:         string;
  text?:        string;
  from?:        string;
  fromName?:    string;
  replyTo?:     string;
  cc?:          string[];
  bcc?:         string[];
  // SendGrid dynamic template (optional — overrides html/subject if set)
  templateId?:  string;
  templateData?: Record<string, unknown>;
  // Tracking
  categories?:  string[];
  sendAt?:      number;  // Unix timestamp for scheduled sends
  ipPoolName?:  string;
  // Suppression
  unsubscribeGroupId?: number;
  // Custom headers
  headers?: Record<string, string>;
}

export interface SendGridContactParams {
  email:       string;
  firstName?:  string;
  lastName?:   string;
  country?:    string;
  phone?:      string;
  customFields?: Record<string, string | number | boolean>;
  listIds?:    string[];
}

export async function sendViaSendGrid(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  params: SendGridEmailParams,
): Promise<{ messageId: string }> {

  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

  const body: Record<string, unknown> = {
    personalizations: [{
      to: toAddresses.map(e => ({ email: e })),
      ...(params.cc?.length  ? { cc:  params.cc.map(e => ({ email: e })) } : {}),
      ...(params.bcc?.length ? { bcc: params.bcc.map(e => ({ email: e })) } : {}),
      ...(params.templateData ? { dynamic_template_data: params.templateData } : {}),
    }],
    from: {
      email: params.from ?? fromEmail,
      name:  params.fromName ?? fromName,
    },
    ...(params.replyTo ? { reply_to: { email: params.replyTo } } : {}),
    ...(params.templateId
      ? { template_id: params.templateId }
      : {
          subject:    params.subject,
          content:    [
            ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
            { type: 'text/html', value: params.html },
          ],
        }
    ),
    ...(params.categories?.length ? { categories: params.categories } : {}),
    ...(params.sendAt ? { send_at: params.sendAt } : {}),
    ...(params.ipPoolName ? { ip_pool_name: params.ipPoolName } : {}),
    ...(params.headers ? { headers: params.headers } : {}),
    ...(params.unsubscribeGroupId ? {
      asm: { group_id: params.unsubscribeGroupId }
    } : {}),
    tracking_settings: {
      click_tracking:  { enable: true },
      open_tracking:   { enable: true },
    },
    mail_settings: {
      bypass_list_management: { enable: false },
    },
  };

  const res = await fetch(`${BASE}/mail/send`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ errors: [{ message: `HTTP ${res.status}` }] }));
    const msg = (err as any).errors?.map((e: any) => e.message).join('; ') ?? `HTTP ${res.status}`;
    throw new Error(`SendGrid: ${msg}`);
  }

  const messageId = res.headers.get('X-Message-Id') ?? '';
  return { messageId };
}

// ── Contacts / Lists (for campaign targeting) ─────────────────────────────────
export async function upsertSendGridContact(
  apiKey: string,
  contact: SendGridContactParams,
): Promise<void> {
  const body: any = {
    contacts: [{
      email:       contact.email,
      first_name:  contact.firstName ?? '',
      last_name:   contact.lastName  ?? '',
      country:     contact.country   ?? '',
      phone_number: contact.phone    ?? '',
      ...(contact.customFields ?? {}),
    }],
  };
  if (contact.listIds?.length) {
    body.list_ids = contact.listIds;
  }

  const res = await fetch(`${BASE}/marketing/contacts`, {
    method:  'PUT',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid contacts: ${err}`);
  }
}

// ── Suppression / Unsubscribes ────────────────────────────────────────────────
export async function addToSendGridSuppression(
  apiKey: string,
  emails: string[],
): Promise<void> {
  await fetch(`${BASE}/asm/suppressions/global`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ recipient_emails: emails }),
  });
}

// ── Test connectivity ─────────────────────────────────────────────────────────
export async function testSendGrid(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  testRecipient: string,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const t0 = Date.now();
  try {
    await sendViaSendGrid(apiKey, fromEmail, fromName, {
      to:         testRecipient,
      subject:    'Hola Prime — SendGrid Test',
      html:       '<p>SendGrid is connected and working correctly from Hola Prime.</p>',
      text:       'SendGrid is connected and working correctly from Hola Prime.',
      categories: ['test'],
    });
    return { ok: true, latencyMs: Date.now() - t0, message: 'Test email sent successfully' };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
  }
}

// ── List SendGrid templates (dynamic templates) ───────────────────────────────
export async function listSendGridTemplates(
  apiKey: string,
): Promise<Array<{ id: string; name: string; updated_at: string }>> {
  const res = await fetch(`${BASE}/templates?generations=dynamic&page_size=50`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json() as { templates?: any[] };
  return (data.templates ?? []).map(t => ({
    id:         t.id,
    name:       t.name,
    updated_at: t.updated_at,
  }));
}
