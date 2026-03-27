import nodemailer, { type Transporter } from 'nodemailer';
import { query, queryOne } from '../../db/index.js';

export interface EmailPayload {
  to:       string | string[];
  subject:  string;
  html:     string;
  text?:    string;
  from?:    string;
  replyTo?: string;
  cc?:      string[];
  bcc?:     string[];
  attachments?: Array<{
    filename: string;
    content:  Buffer | string;
    contentType?: string;
  }>;
}

// ── Transport factory ─────────────────────────────────────────────────────────
async function createTransport(cfg: {
  provider:   string;
  host?:      string;
  port?:      number;
  username?:  string;
  password?:  string;
  apiKey?:    string;
}): Promise<Transporter> {

  switch (cfg.provider) {
    case 'sendgrid':
      return nodemailer.createTransport({
        host:   'smtp.sendgrid.net',
        port:   587,
        secure: false,
        auth:   { user: 'apikey', pass: cfg.apiKey },
      });

    case 'ses':
      // AWS SES via SMTP
      return nodemailer.createTransport({
        host:   cfg.host ?? `email-smtp.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`,
        port:   587,
        secure: false,
        auth:   { user: cfg.username, pass: cfg.password },
      });

    case 'mailgun':
      return nodemailer.createTransport({
        host:   cfg.host ?? 'smtp.mailgun.org',
        port:   587,
        secure: false,
        auth:   { user: cfg.username, pass: cfg.password ?? cfg.apiKey },
      });

    case 'smtp2go':
      return nodemailer.createTransport({
        host:   'mail.smtp2go.com',
        port:   587,
        secure: false,
        auth:   { user: cfg.username, pass: cfg.password ?? cfg.apiKey },
      });

    case 'custom':
    default:
      return nodemailer.createTransport({
        host:   cfg.host,
        port:   cfg.port ?? 587,
        secure: (cfg.port ?? 587) === 465,
        auth:   { user: cfg.username, pass: cfg.password },
      });
  }
}

// ── Cache per config id ───────────────────────────────────────────────────────
const transportCache = new Map<string, { transport: Transporter; fromEmail: string; fromName: string }>();

async function getDefaultTransport() {
  const cfg = await queryOne<{
    id: string; provider: string; host?: string; port?: number;
    username?: string; password?: string; api_key?: string;
    from_email: string; from_name: string;
  }>('SELECT * FROM smtp_configs WHERE is_active = true AND is_default = true LIMIT 1');

  if (!cfg) {
    // Fallback to env-based SendGrid (backward compat)
    if (process.env.SENDGRID_API_KEY) {
      const transport = await createTransport({
        provider: 'sendgrid',
        apiKey:   process.env.SENDGRID_API_KEY,
      });
      return {
        transport,
        fromEmail: process.env.EMAIL_FROM ?? 'noreply@holaprime.com',
        fromName:  'Hola Prime',
      };
    }
    throw new Error('No SMTP configuration found. Add one in Settings → Email or set SENDGRID_API_KEY in .env');
  }

  if (!transportCache.has(cfg.id)) {
    const transport = await createTransport({
      provider: cfg.provider,
      host:     cfg.host,
      port:     cfg.port,
      username: cfg.username,
      password: cfg.password,
      apiKey:   cfg.api_key,
    });
    transportCache.set(cfg.id, { transport, fromEmail: cfg.from_email, fromName: cfg.from_name });
  }

  return transportCache.get(cfg.id)!;
}

// ── Main send function ────────────────────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<{ messageId: string }> {
  const { transport, fromEmail, fromName } = await getDefaultTransport();

  const info = await transport.sendMail({
    from:        payload.from ?? `"${fromName}" <${fromEmail}>`,
    to:          Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
    cc:          payload.cc?.join(', '),
    bcc:         payload.bcc?.join(', '),
    replyTo:     payload.replyTo,
    subject:     payload.subject,
    html:        payload.html,
    text:        payload.text,
    attachments: payload.attachments,
  });

  return { messageId: info.messageId ?? '' };
}

// ── Test a configuration without saving ──────────────────────────────────────
export async function testSmtpConfig(cfg: {
  provider: string; host?: string; port?: number;
  username?: string; password?: string; apiKey?: string;
  fromEmail: string; fromName: string;
  testRecipient: string;
}): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const t0 = Date.now();
  try {
    const transport = await createTransport(cfg);
    await transport.verify();

    await transport.sendMail({
      from:    `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to:      cfg.testRecipient,
      subject: 'Hola Prime — SMTP Test',
      html:    '<p>This is a test email from Hola Prime Admin Platform. Your SMTP configuration is working correctly.</p>',
    });

    return { ok: true, message: 'Test email sent successfully', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, message: String(err), latencyMs: Date.now() - t0 };
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function listSmtpConfigs() {
  return query(`
    SELECT id, name, provider, host, port, username, from_email, from_name,
           is_active, is_default, last_test_at, last_test_ok, created_at
    FROM smtp_configs ORDER BY is_default DESC, name
  `);
}

export async function saveSmtpConfig(data: {
  id?:       string;
  name:      string;
  provider:  string;
  host?:     string;
  port?:     number;
  username?: string;
  password?: string;
  apiKey?:   string;
  fromEmail: string;
  fromName:  string;
  isDefault?: boolean;
}): Promise<string> {
  if (data.isDefault) {
    // Only one default at a time
    await query('UPDATE smtp_configs SET is_default = false');
  }

  if (data.id) {
    await query(`
      UPDATE smtp_configs
      SET name=$1, provider=$2, host=$3, port=$4, username=$5, password=$6,
          api_key=$7, from_email=$8, from_name=$9, is_default=$10, updated_at=NOW()
      WHERE id=$11
    `, [data.name, data.provider, data.host, data.port, data.username,
        data.password, data.apiKey, data.fromEmail, data.fromName,
        data.isDefault ?? false, data.id]);
    transportCache.delete(data.id);
    return data.id;
  }

  const [row] = await query<{ id: string }>(`
    INSERT INTO smtp_configs
      (name, provider, host, port, username, password, api_key,
       from_email, from_name, is_default)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id
  `, [data.name, data.provider, data.host, data.port, data.username,
      data.password, data.apiKey, data.fromEmail, data.fromName,
      data.isDefault ?? false]);
  return row.id;
}

export async function deleteSmtpConfig(id: string): Promise<void> {
  await query('DELETE FROM smtp_configs WHERE id = $1', [id]);
  transportCache.delete(id);
}

export async function setDefaultSmtpConfig(id: string): Promise<void> {
  await query('UPDATE smtp_configs SET is_default = false');
  await query('UPDATE smtp_configs SET is_default = true WHERE id = $1', [id]);
  transportCache.clear();
}
