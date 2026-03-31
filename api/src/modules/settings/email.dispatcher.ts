/**
 * Hola Prime Email Dispatcher — Dual-provider architecture
 *
 * ROUTING RULES:
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  SENDGRID          │  Transactional, 1:1, time-critical          │
 * │                    │  OTP codes, admin invites, password reset   │
 * │                    │  KYC approved/rejected, account events      │
 * │                    │  Payout approved, challenge passed/breached │
 * │                    │  System alerts to internal team             │
 * ├────────────────────┼─────────────────────────────────────────────┤
 * │  MAILMODO          │  Bulk campaigns, AMP journeys, broadcasts   │
 * │                    │  Re-engagement sequences, win-back flows    │
 * │                    │  Weekly/monthly newsletters                  │
 * │                    │  Campaign Manager sends                     │
 * ├────────────────────┼─────────────────────────────────────────────┤
 * │  SMTP (fallback)   │  If SendGrid not configured                 │
 * │                    │  Dev/staging environments                   │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { sendViaSendGrid }   from './sendgrid.service.js';
import { sendViaMailmodo }   from './mailmodo.service.js';
import { sendEmail }         from './smtp.service.js';
import { queryOne }          from '../../db/index.js';

// ── Email type classification ─────────────────────────────────────────────────

export type EmailProvider = 'sendgrid' | 'mailmodo' | 'smtp';

export type TransactionalEmailType =
  | 'otp'
  | 'password_reset'
  | 'admin_invite'
  | 'admin_password_reset'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'challenge_purchased'
  | 'challenge_passed'
  | 'challenge_breached'
  | 'payout_approved'
  | 'payout_rejected'
  | 'welcome'
  | 'account_funded'
  | 'system_alert';

export type BulkEmailType =
  | 'campaign'
  | 'win_back'
  | 'reengagement'
  | 'newsletter'
  | 'broadcast';

// Transactional types always go via SendGrid (or SMTP fallback)
const SENDGRID_TYPES = new Set<TransactionalEmailType>([
  'otp', 'password_reset', 'admin_invite', 'admin_password_reset',
  'kyc_approved', 'kyc_rejected', 'challenge_purchased', 'challenge_passed',
  'challenge_breached', 'payout_approved', 'payout_rejected',
  'welcome', 'account_funded', 'system_alert',
]);

// Bulk types always go via Mailmodo
const MAILMODO_TYPES = new Set<BulkEmailType>([
  'campaign', 'win_back', 'reengagement', 'newsletter', 'broadcast',
]);

export interface DispatchEmailParams {
  to:           string | string[];
  subject:      string;
  html:         string;
  text?:        string;
  fromName?:    string;
  fromEmail?:   string;
  replyTo?:     string;
  cc?:          string[];
  bcc?:         string[];
  // Routing
  emailType?:   TransactionalEmailType | BulkEmailType;
  provider?:    EmailProvider;   // override automatic routing
  // SendGrid specific
  categories?:  string[];
  templateId?:  string;         // SendGrid dynamic template ID
  templateData?: Record<string, unknown>;
  sendAt?:      number;         // schedule for future (Unix timestamp)
  // Mailmodo specific
  mailmodoCampaignId?:  string;
  mailmodoData?:        Record<string, string | number | boolean>;
}

// ── Provider credential cache ─────────────────────────────────────────────────

interface EmailProviderConfig {
  sendgrid?: { apiKey: string; fromEmail: string; fromName: string };
  mailmodo?: { apiKey: string };
  smtp?:     { configured: boolean };
}

let configCache: EmailProviderConfig | null = null;
let configCacheAt = 0;
const CACHE_TTL = 60_000; // re-read every 60s

async function getProviderConfig(): Promise<EmailProviderConfig> {
  if (configCache && Date.now() - configCacheAt < CACHE_TTL) return configCache;

  const cfg: EmailProviderConfig = {};

  // SendGrid — from integration_credentials table or env
  const sgCred = await queryOne<{ credentials: any }>(
    `SELECT credentials FROM integration_credentials WHERE service_key = 'sendgrid' AND is_active = true LIMIT 1`
  );
  const sgApiKey = sgCred?.credentials?.api_key ?? process.env.SENDGRID_API_KEY;
  if (sgApiKey) {
    cfg.sendgrid = {
      apiKey:    sgApiKey,
      fromEmail: sgCred?.credentials?.from_email ?? process.env.EMAIL_FROM ?? 'noreply@holaprime.com',
      fromName:  sgCred?.credentials?.from_name  ?? 'Hola Prime',
    };
  }

  // Mailmodo — from integration_credentials table or env
  const mmCred = await queryOne<{ credentials: any }>(
    `SELECT credentials FROM integration_credentials WHERE service_key = 'mailmodo' AND is_active = true LIMIT 1`
  );
  const mmApiKey = mmCred?.credentials?.api_key ?? process.env.MAILMODO_API_KEY;
  if (mmApiKey) {
    cfg.mailmodo = { apiKey: mmApiKey };
  }

  // SMTP — check if any active config exists
  const smtpCfg = await queryOne(
    `SELECT id FROM smtp_configs WHERE is_active = true LIMIT 1`
  );
  cfg.smtp = { configured: !!smtpCfg || !!process.env.SENDGRID_API_KEY };

  configCache = cfg;
  configCacheAt = Date.now();
  return cfg;
}

export function clearProviderCache() {
  configCache = null;
}

// ── Core dispatcher ───────────────────────────────────────────────────────────

export async function dispatchEmail(params: DispatchEmailParams): Promise<void> {
  const config = await getProviderConfig();

  // Determine which provider to use
  let provider: EmailProvider = 'smtp';

  if (params.provider) {
    // Explicit override
    provider = params.provider;
  } else if (params.emailType && MAILMODO_TYPES.has(params.emailType as BulkEmailType)) {
    // Bulk email → Mailmodo
    provider = 'mailmodo';
  } else if (params.mailmodoCampaignId) {
    // Has explicit Mailmodo campaign ID → Mailmodo
    provider = 'mailmodo';
  } else {
    // Transactional or default → SendGrid first, SMTP fallback
    provider = config.sendgrid ? 'sendgrid' : 'smtp';
  }

  // Route to provider
  switch (provider) {
    case 'sendgrid': {
      if (!config.sendgrid) {
        // Fall through to SMTP
        console.warn('[email] SendGrid not configured, falling back to SMTP');
        await sendEmail({
          to:      params.to as string,
          subject: params.subject,
          html:    params.html,
          text:    params.text,
          from:    params.fromEmail,
          replyTo: params.replyTo,
        });
        return;
      }
      const toArray = Array.isArray(params.to) ? params.to : [params.to];
      await sendViaSendGrid(
        config.sendgrid.apiKey,
        params.fromEmail ?? config.sendgrid.fromEmail,
        params.fromName  ?? config.sendgrid.fromName,
        {
          to:           toArray,
          subject:      params.subject,
          html:         params.html,
          text:         params.text,
          replyTo:      params.replyTo,
          cc:           params.cc,
          bcc:          params.bcc,
          categories:   params.categories ?? (params.emailType ? [params.emailType] : undefined),
          templateId:   params.templateId,
          templateData: params.templateData,
          sendAt:       params.sendAt,
        }
      );
      return;
    }

    case 'mailmodo': {
      if (!config.mailmodo) {
        console.warn('[email] Mailmodo not configured, falling back to SendGrid/SMTP');
        // Try SendGrid fallback for bulk too (better than nothing)
        if (config.sendgrid) {
          await sendViaSendGrid(
            config.sendgrid.apiKey,
            config.sendgrid.fromEmail,
            config.sendgrid.fromName,
            { to: params.to as string, subject: params.subject, html: params.html, text: params.text }
          );
        } else {
          await sendEmail({ to: params.to as string, subject: params.subject, html: params.html, text: params.text });
        }
        return;
      }
      if (!params.mailmodoCampaignId) {
        // No campaign ID — can't send via Mailmodo, fall back
        console.warn('[email] Mailmodo send requested but no campaignId provided, falling back');
        if (config.sendgrid) {
          await sendViaSendGrid(
            config.sendgrid.apiKey,
            config.sendgrid.fromEmail,
            config.sendgrid.fromName,
            { to: params.to as string, subject: params.subject, html: params.html, text: params.text }
          );
        }
        return;
      }
      await sendViaMailmodo(config.mailmodo.apiKey, {
        campaignId: params.mailmodoCampaignId,
        to:         params.to as string,
        subject:    params.subject,
        data:       params.mailmodoData,
      });
      return;
    }

    case 'smtp':
    default: {
      await sendEmail({
        to:      params.to as string,
        subject: params.subject,
        html:    params.html,
        text:    params.text,
        from:    params.fromEmail,
        replyTo: params.replyTo,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONAL EMAIL HELPERS — all go via SendGrid
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendOtpEmail(
  to: string, firstName: string, otp: string, purpose: 'registration' | 'password_reset' = 'registration'
): Promise<void> {
  const isReset = purpose === 'password_reset';
  await dispatchEmail({
    to,
    emailType: 'otp',
    subject:   isReset ? 'Reset your Hola Prime password' : 'Your Hola Prime verification code',
    categories: [isReset ? 'password_reset_otp' : 'registration_otp'],
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:40px;text-align:center">
      <div style="font-size:18px;font-weight:800;margin-bottom:8px">${isReset ? 'Password Reset Code' : 'Verification Code'}</div>
      <p style="color:#94A3B8;font-size:14px;margin-bottom:24px">Hi ${firstName}, ${isReset ? 'use this code to reset your password' : 'enter this code to verify your account'}</p>
      <div style="background:#1C2A3A;border-radius:12px;padding:24px;margin:0 auto 24px;display:inline-block;min-width:200px">
        <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#4F8CF7">${otp}</div>
      </div>
      <p style="color:#94A3B8;font-size:13px">Expires in 10 minutes. Do not share this code with anyone.</p>
      ${isReset ? '<p style="color:#64748B;font-size:12px;margin-top:16px">If you did not request this, ignore this email.</p>' : ''}
    </div>`,
    text: `Your ${isReset ? 'password reset' : 'verification'} code is: ${otp}\n\nExpires in 10 minutes. Do not share this code.`,
  });
}

export async function sendAdminInviteEmail(
  to: string, inviteeName: string, inviterName: string,
  role: string, loginUrl: string, tempPassword: string,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'admin_invite',
    categories: ['admin_invite'],
    subject:    `You have been invited to Hola Prime Command Centre`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1B3A6B,#0B1120);padding:32px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:2px">HOLA PRIME</div>
        <div style="color:#94A3B8;font-size:13px;margin-top:6px">Command Centre Access</div>
      </div>
      <div style="padding:32px">
        <h1 style="font-size:20px;font-weight:800;margin:0 0 16px">Hi ${inviteeName},</h1>
        <p style="color:#94A3B8;line-height:1.7">${inviterName} has invited you to access the Hola Prime Command Centre as <strong style="color:#F5B326">${role}</strong>.</p>
        <div style="background:#1C2A3A;border-radius:10px;padding:20px;margin:24px 0">
          <div style="font-size:12px;color:#64748B;margin-bottom:12px">YOUR LOGIN CREDENTIALS</div>
          <div style="margin-bottom:10px"><span style="color:#94A3B8;font-size:13px">Email:</span><br/><code style="color:#60A9F0;font-size:15px">${to}</code></div>
          <div><span style="color:#94A3B8;font-size:13px">Temporary Password:</span><br/><code style="color:#F5B326;font-size:15px;letter-spacing:2px">${tempPassword}</code></div>
        </div>
        <p style="color:#94A3B8;font-size:14px">Please change your password after your first login.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${loginUrl}" style="display:inline-block;background:#3F8FE0;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">Access Command Centre →</a>
        </div>
      </div>
    </div>`,
    text: `Hi ${inviteeName},\n\n${inviterName} has invited you to Hola Prime Command Centre as ${role}.\n\nEmail: ${to}\nTemp Password: ${tempPassword}\n\nLogin: ${loginUrl}\n\nChange your password after first login.`,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'welcome',
    categories: ['welcome'],
    subject:    `Welcome to Hola Prime, ${firstName}!`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1B3A6B,#0B1120);padding:32px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:2px">HOLA PRIME</div>
      </div>
      <div style="padding:32px">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 12px">Welcome, ${firstName}! 👋</h1>
        <p style="color:#94A3B8;line-height:1.7">You have joined 20,000+ funded traders worldwide. Choose your challenge to get started and prove your trading skills.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="https://app.holaprime.com" style="display:inline-block;background:#3F8FE0;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700">Browse Challenges →</a>
        </div>
      </div>
    </div>`,
    text: `Welcome to Hola Prime, ${firstName}! Browse challenges at https://app.holaprime.com`,
  });
}

export async function sendKycApprovedEmail(to: string, firstName: string): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'kyc_approved',
    categories: ['kyc_approved'],
    subject:    'Your identity has been verified ✅',
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="color:#38BA82">KYC Approved ✅</h1>
      <p style="color:#94A3B8">Hi ${firstName}, your identity has been verified. You can now request payouts from your funded account.</p>
    </div>`,
    text: `Hi ${firstName}, your KYC has been approved. You can now request payouts.`,
  });
}

export async function sendKycRejectedEmail(to: string, firstName: string, reason?: string): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'kyc_rejected',
    categories: ['kyc_rejected'],
    subject:    'Action required — identity verification',
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="color:#FF4C6A">Verification needs attention</h1>
      <p style="color:#94A3B8">Hi ${firstName}, your KYC submission needs attention.${reason ? ` Reason: ${reason}` : ''}</p>
      <p style="color:#94A3B8">Please resubmit with the correct documents or contact support.</p>
    </div>`,
    text: `Hi ${firstName}, your KYC needs attention.${reason ? ` Reason: ${reason}` : ''} Please resubmit or contact support.`,
  });
}

export async function sendChallengePurchasedEmail(
  to: string, firstName: string,
  productName: string, platformLogin: string, platformServer: string,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'challenge_purchased',
    categories: ['challenge_purchased'],
    subject:    `Your ${productName} account is ready 🚀`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="font-size:20px;font-weight:800">Your account is ready!</h1>
      <p style="color:#94A3B8">Hi ${firstName}, your <strong>${productName}</strong> challenge account has been provisioned.</p>
      <div style="background:#1C2A3A;border-radius:10px;padding:20px;margin:20px 0">
        <div style="margin-bottom:10px"><span style="color:#64748B;font-size:12px">LOGIN</span><br/><code style="color:#60A9F0">${platformLogin}</code></div>
        <div><span style="color:#64748B;font-size:12px">SERVER</span><br/><code style="color:#60A9F0">${platformServer}</code></div>
      </div>
      <p style="color:#94A3B8;font-size:14px">Log in to your trading platform and start your challenge. Good luck!</p>
    </div>`,
    text: `Hi ${firstName}, your ${productName} account is ready.\nLogin: ${platformLogin}\nServer: ${platformServer}`,
  });
}

export async function sendAccountPassedEmail(
  to: string, firstName: string, productName: string, kycUrl?: string,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'challenge_passed',
    categories: ['challenge_passed'],
    subject:    `Congratulations! You passed the ${productName} 🎉`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🎉</div>
      <h1 style="font-size:24px;font-weight:900;color:#38BA82">You Passed!</h1>
      <p style="color:#94A3B8">Hi ${firstName}, you passed your <strong>${productName}</strong>! Complete KYC to receive your funded account.</p>
      ${kycUrl ? `<div style="margin:24px 0"><a href="${kycUrl}" style="display:inline-block;background:#38BA82;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700">Complete KYC →</a></div>` : ''}
    </div>`,
    text: `Congratulations ${firstName}! You passed the ${productName}.${kycUrl ? ` Complete KYC: ${kycUrl}` : ''}`,
  });
}

export async function sendAccountBreachedEmail(
  to: string, firstName: string, reason: string,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'challenge_breached',
    categories: ['challenge_breached'],
    subject:    'Your challenge account has been closed',
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="font-size:20px;color:#FF4C6A">Account Closed</h1>
      <p style="color:#94A3B8">Hi ${firstName}, unfortunately your challenge account was closed.</p>
      <div style="background:#2A1C1C;border-radius:8px;padding:14px;border-left:3px solid #FF4C6A;margin:16px 0">
        <div style="font-size:12px;color:#64748B;margin-bottom:4px">REASON</div>
        <div style="color:#F1F5F9">${reason}</div>
      </div>
      <p style="color:#94A3B8;font-size:14px">Every great trader has been here. Start a new challenge and come back stronger.</p>
    </div>`,
    text: `Hi ${firstName}, your challenge was closed. Reason: ${reason}. Start a new challenge to continue.`,
  });
}

export async function sendPayoutApprovedEmail(
  to: string, firstName: string, amount: string, method?: string,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'payout_approved',
    categories: ['payout_approved'],
    subject:    `Your payout of ${amount} has been sent 💸`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">💸</div>
      <h1 style="font-size:24px;font-weight:900;color:#38BA82">${amount} Sent!</h1>
      <p style="color:#94A3B8">Hi ${firstName}, your payout of <strong>${amount}</strong>${method ? ` via ${method}` : ''} has been processed. Arrives in 1-3 business days.</p>
    </div>`,
    text: `Hi ${firstName}, your payout of ${amount}${method ? ` via ${method}` : ''} has been sent.`,
  });
}

export async function sendPayoutRejectedEmail(
  to: string, firstName: string, amount: string, reason: string,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:  'payout_approved', // reuse category
    categories: ['payout_rejected'],
    subject:    'Payout request update',
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="color:#FF4C6A">Payout Not Processed</h1>
      <p style="color:#94A3B8">Hi ${firstName}, your payout request of <strong>${amount}</strong> was not processed.</p>
      <div style="background:#2A1C1C;border-radius:8px;padding:14px;border-left:3px solid #FF4C6A;margin:16px 0">
        <div style="color:#F1F5F9">${reason}</div>
      </div>
      <p style="color:#94A3B8;font-size:14px">Please contact support if you have questions.</p>
    </div>`,
    text: `Hi ${firstName}, payout of ${amount} was not processed. Reason: ${reason}.`,
  });
}

export async function sendPasswordResetEmail(
  to: string, firstName: string, otp: string,
): Promise<void> {
  await sendOtpEmail(to, firstName, otp, 'password_reset');
}

// ── Mailmodo campaign triggers (bulk) ─────────────────────────────────────────

export async function triggerMailmodoCampaign(
  to: string,
  campaignId: string,
  data: Record<string, string | number | boolean>,
): Promise<void> {
  await dispatchEmail({
    to,
    emailType:           'campaign',
    subject:             '', // Mailmodo uses campaign subject
    html:                '',
    mailmodoCampaignId:  campaignId,
    mailmodoData:        data,
  });
}

export async function sendWinBackEmail(
  to: string, firstName: string, promoCode: string, campaignId?: string,
): Promise<void> {
  if (campaignId) {
    await triggerMailmodoCampaign(to, campaignId, { first_name: firstName, promo_code: promoCode });
    return;
  }
  // Fallback HTML via SendGrid if no Mailmodo campaign configured
  await dispatchEmail({
    to,
    emailType:  'win_back',
    categories: ['win_back'],
    subject:    `${firstName}, your funded account is waiting for you 👋`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="font-size:20px;font-weight:800">We miss you, ${firstName}!</h1>
      <p style="color:#94A3B8;line-height:1.7">It has been a while. Use code <strong style="color:#F5B326">${promoCode}</strong> for 15% off your next challenge.</p>
      <div style="text-align:center;margin:24px 0"><a href="https://app.holaprime.com" style="display:inline-block;background:#38BA82;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700">Claim Offer →</a></div>
    </div>`,
    text: `Hi ${firstName}, use code ${promoCode} for 15% off your next challenge at https://app.holaprime.com`,
  });
}

export async function sendReengagementEmail(
  to: string, firstName: string, data: Record<string, string | number | boolean>, campaignId?: string,
): Promise<void> {
  if (campaignId) {
    await triggerMailmodoCampaign(to, campaignId, { first_name: firstName, ...data });
    return;
  }
  await dispatchEmail({
    to,
    emailType:  'reengagement',
    categories: ['reengagement'],
    subject:    `${firstName}, markets are moving — are you?`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:32px">
      <h1 style="font-size:20px">Ready to trade again, ${firstName}?</h1>
      <p style="color:#94A3B8">Log back in and take your next challenge.</p>
    </div>`,
    text: `Hi ${firstName}, log back in at https://app.holaprime.com`,
  });
}
