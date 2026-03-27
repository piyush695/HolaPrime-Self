// Central email dispatcher — all code calls this, never the provider directly.
// Priority: Mailmodo (if configured) → SMTP (if configured) → error.

import { queryOne } from '../../db/index.js';
import { sendViaMailmodo } from './mailmodo.service.js';

export interface DispatchEmailParams {
  to:          string;
  subject:     string;
  html:        string;
  text?:       string;
  // Mailmodo campaign trigger (optional — falls back to SMTP if not provided)
  mailmodoCampaignId?: string;
  // Template variables for Mailmodo
  templateData?: Record<string, string | number | boolean>;
}

export async function dispatchEmail(params: DispatchEmailParams): Promise<void> {
  // 1. Try Mailmodo first if a campaign ID is provided and Mailmodo is configured
  if (params.mailmodoCampaignId) {
    const apiKey = process.env.MAILMODO_API_KEY;
    if (apiKey) {
      await sendViaMailmodo(apiKey, {
        campaignId: params.mailmodoCampaignId,
        to:         params.to,
        subject:    params.subject,
        data:       params.templateData,
      });
      return;
    }
  }

  // 2. Fall back to SMTP (nodemailer-based multi-provider)
  const { sendEmail } = await import('./smtp.service.js');
  await sendEmail({
    to:      params.to,
    subject: params.subject,
    html:    params.html,
    text:    params.text,
  });
}

// ── Lifecycle email helpers ───────────────────────────────────────────────────
// Call these from services — they pick the right campaign ID from env automatically

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             `Welcome to Hola Prime, ${firstName}!`,
    html:                `<p>Hi ${firstName}, welcome to Hola Prime Markets.</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_WELCOME,
    templateData:        { first_name: firstName },
  });
}

export async function sendKycApprovedEmail(to: string, firstName: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             'Your identity has been verified ✅',
    html:                `<p>Hi ${firstName}, your KYC has been approved. You can now request payouts.</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_KYC_APPROVED,
    templateData:        { first_name: firstName },
  });
}

export async function sendKycRejectedEmail(to: string, firstName: string, reason?: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             'Action required — identity verification',
    html:                `<p>Hi ${firstName}, your KYC submission needs attention. ${reason ? `Reason: ${reason}` : 'Please contact support.'}</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_KYC_REJECTED,
    templateData:        { first_name: firstName, reason: reason ?? '' },
  });
}

export async function sendChallengePurchasedEmail(
  to: string, firstName: string,
  productName: string, platformLogin: string, platformServer: string,
): Promise<void> {
  await dispatchEmail({
    to,
    subject:             `Your ${productName} account is ready 🚀`,
    html:                `<p>Hi ${firstName}, your challenge account has been provisioned.</p>
                          <p>Login: <strong>${platformLogin}</strong><br>Server: <strong>${platformServer}</strong></p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_CHALLENGE_PURCHASED,
    templateData:        { first_name: firstName, product_name: productName, login: platformLogin, server: platformServer },
  });
}

export async function sendAccountPassedEmail(to: string, firstName: string, productName: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             `Congratulations! You passed the ${productName} 🎉`,
    html:                `<p>Hi ${firstName}, you have successfully passed your challenge!</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_ACCOUNT_PASSED,
    templateData:        { first_name: firstName, product_name: productName },
  });
}

export async function sendAccountBreachedEmail(to: string, firstName: string, reason: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             'Your challenge account has been closed',
    html:                `<p>Hi ${firstName}, unfortunately your account was closed. Reason: ${reason}.</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_ACCOUNT_BREACHED,
    templateData:        { first_name: firstName, reason },
  });
}

export async function sendPayoutApprovedEmail(to: string, firstName: string, amount: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             `Your payout of ${amount} has been approved 💸`,
    html:                `<p>Hi ${firstName}, your payout of ${amount} has been approved and is being processed.</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_PAYOUT_APPROVED,
    templateData:        { first_name: firstName, amount },
  });
}

export async function sendPasswordResetEmail(to: string, firstName: string, resetLink: string): Promise<void> {
  await dispatchEmail({
    to,
    subject:             'Reset your Hola Prime password',
    html:                `<p>Hi ${firstName}, click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    mailmodoCampaignId:  process.env.MAILMODO_CAMPAIGN_PASSWORD_RESET,
    templateData:        { first_name: firstName, reset_link: resetLink },
  });
}
