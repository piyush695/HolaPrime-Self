// Mailmodo sends emails by triggering pre-built campaigns from their dashboard.
// Each email type (welcome, KYC approved, challenge purchased, etc.) needs
// its own campaign created in Mailmodo, which gives you a campaign ID.
// You store those IDs in .env or the smtp_configs table.

const BASE = 'https://api.mailmodo.com/api/v1';

export interface MailmodoSendParams {
  campaignId:  string;          // from Mailmodo dashboard > Transactional > Trigger Info
  to:          string;
  subject?:    string;          // overrides the campaign subject
  data?:       Record<string, string | number | boolean>;  // template variables
  addToList?:  string;          // optional Mailmodo list ID
}

export async function sendViaMailmodo(
  apiKey: string,
  params: MailmodoSendParams,
): Promise<{ success: boolean; messageId?: string }> {
  const body: Record<string, unknown> = {
    email:     params.to,
    data:      params.data ?? {},
  };
  if (params.subject)   body.subject   = params.subject;
  if (params.addToList) body.addToList = params.addToList;

  const res = await fetch(`${BASE}/triggerCampaign/${params.campaignId}`, {
    method:  'POST',
    headers: {
      'mmApiKey':     apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mailmodo ${res.status}: ${err}`);
  }

  const data = await res.json() as { success?: boolean; id?: string };
  return { success: data.success ?? true, messageId: data.id };
}

// Verify connectivity (ping their API)
export async function testMailmodo(apiKey: string): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/campaign/list?page=1&limit=1`, {
      headers: { 'mmApiKey': apiKey },
    });
    return { ok: res.ok, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, message: String(err) };
  }
}

// Campaign ID registry — stored in smtp_configs.config or .env
export interface MailmodoCampaigns {
  welcome?:          string;
  kycApproved?:      string;
  kycRejected?:      string;
  challengePurchased?:string;
  accountPassed?:    string;
  accountBreached?:  string;
  payoutApproved?:   string;
  passwordReset?:    string;
  // Add more as you create campaigns in Mailmodo
}
