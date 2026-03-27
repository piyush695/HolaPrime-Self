import { createHmac } from 'crypto';
import { query, queryOne, withTransaction } from '../../db/index.js';

const BASE = 'https://api.sumsub.com';

// ── SumSub REST helper ────────────────────────────────────────────────────────
function sumsubSign(
  secretKey: string,
  method: string,
  url: string,
  ts: number,
  body?: string,
): string {
  const data = ts + method.toUpperCase() + url + (body ?? '');
  return createHmac('sha256', secretKey).update(data).digest('hex');
}

async function sumsubReq<T>(
  appToken: string,
  secretKey: string,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const ts       = Math.floor(Date.now() / 1000);
  const bodyStr  = body ? JSON.stringify(body) : undefined;
  const sig      = sumsubSign(secretKey, method, path, ts, bodyStr);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'X-App-Token':    appToken,
      'X-App-Access-Ts':  String(ts),
      'X-App-Access-Sig': sig,
      'Content-Type':   'application/json',
      ...extraHeaders,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SumSub ${res.status}: ${err}`);
  }

  // Some endpoints return no body
  const text = await res.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

// ── SumSub service ────────────────────────────────────────────────────────────
export class SumsubService {
  constructor(
    private readonly appToken:    string,
    private readonly secretKey:   string,
    private readonly levelName:   string = 'basic-kyc-level',
  ) {}

  private req<T>(method: string, path: string, body?: unknown) {
    return sumsubReq<T>(this.appToken, this.secretKey, method, path, body);
  }

  /** Create a SumSub applicant for a user */
  async createApplicant(params: {
    userId:      string;
    email:       string;
    phone?:      string;
    firstName?:  string;
    lastName?:   string;
    countryCode?: string;
  }): Promise<string> {
    const existing = await queryOne<{ applicant_id: string }>(
      'SELECT applicant_id FROM sumsub_applicants WHERE user_id = $1', [params.userId],
    );
    if (existing) return existing.applicant_id;

    const applicant = await this.req<{ id: string }>('POST', `/resources/applicants?levelName=${this.levelName}`, {
      externalUserId: params.userId,
      email:          params.email,
      phone:          params.phone,
      fixedInfo: {
        firstName:   params.firstName,
        lastName:    params.lastName,
        country:     params.countryCode,
      },
    });

    await query(`
      INSERT INTO sumsub_applicants (user_id, applicant_id, level_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET applicant_id = $2, updated_at = NOW()
    `, [params.userId, applicant.id, this.levelName]);

    return applicant.id;
  }

  /** Generate a short-lived access token for the SumSub SDK (WebSDK / Mobile SDK) */
  async getAccessToken(userId: string, ttlInSecs = 600): Promise<string> {
    const row = await queryOne<{ applicant_id: string; access_token: string; access_token_expires_at: string }>(
      'SELECT * FROM sumsub_applicants WHERE user_id = $1', [userId],
    );

    if (!row) throw new Error('Applicant not found — call createApplicant first');

    // Return cached token if still valid
    if (row.access_token && row.access_token_expires_at) {
      const expiresAt = new Date(row.access_token_expires_at);
      if (expiresAt > new Date(Date.now() + 60_000)) {
        return row.access_token;
      }
    }

    const token = await this.req<{ token: string; userId: string }>(
      'POST',
      `/resources/accessTokens?userId=${row.applicant_id}&ttlInSecs=${ttlInSecs}`,
    );

    await query(`
      UPDATE sumsub_applicants
      SET access_token = $1, access_token_expires_at = $2, updated_at = NOW()
      WHERE user_id = $3
    `, [token.token, new Date(Date.now() + ttlInSecs * 1000).toISOString(), userId]);

    return token.token;
  }

  /** Get applicant status from SumSub */
  async getApplicantStatus(applicantId: string): Promise<{
    reviewStatus: string;
    reviewResult?: { reviewAnswer: string; rejectLabels?: string[] };
  }> {
    return this.req('GET', `/resources/applicants/${applicantId}/status`);
  }

  /** Fetch full applicant data */
  async getApplicant(applicantId: string): Promise<Record<string, unknown>> {
    return this.req('GET', `/resources/applicants/${applicantId}/one`);
  }

  /** Reset applicant (create new review after rejection) */
  async resetApplicant(applicantId: string): Promise<void> {
    await this.req('POST', `/resources/applicants/${applicantId}/reset`);
  }

  /** Verify SumSub webhook signature */
  verifyWebhookSignature(secretKey: string, rawBody: string, signature: string): boolean {
    const expected = createHmac('sha256', secretKey).update(rawBody).digest('hex');
    return expected === signature;
  }

  /** Process incoming SumSub webhook and update our database */
  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    if (!this.verifyWebhookSignature(this.secretKey, rawBody, signature)) {
      throw new Error('Invalid SumSub webhook signature');
    }

    const event = JSON.parse(rawBody) as {
      type:         string;
      applicantId:  string;
      reviewStatus: string;
      reviewResult?: {
        reviewAnswer:    string;
        rejectLabels?:   string[];
        moderationComment?: string;
        clientComment?:  string;
      };
    };

    const applicant = await queryOne<{ user_id: string; id: string }>(
      'SELECT * FROM sumsub_applicants WHERE applicant_id = $1', [event.applicantId],
    );

    if (!applicant) {
      console.warn('[sumsub] Webhook for unknown applicant:', event.applicantId);
      return;
    }

    await withTransaction(async (client) => {
      // Update sumsub_applicants table
      await client.query(`
        UPDATE sumsub_applicants
        SET review_status = $1,
            review_result = $2,
            reject_labels = $3,
            moderation_comment = $4,
            client_comment = $5,
            webhook_payload = $6,
            updated_at = NOW()
        WHERE applicant_id = $7
      `, [
        event.reviewStatus,
        event.reviewResult?.reviewAnswer ?? null,
        event.reviewResult?.rejectLabels ?? [],
        event.reviewResult?.moderationComment ?? null,
        event.reviewResult?.clientComment ?? null,
        JSON.stringify(event),
        event.applicantId,
      ]);

      // Map SumSub result to our kyc_status
      let kycStatus: string | null = null;
      let submissionStatus: string | null = null;

      if (event.type === 'applicantReviewed') {
        if (event.reviewResult?.reviewAnswer === 'GREEN') {
          kycStatus         = 'approved';
          submissionStatus  = 'approved';
        } else if (event.reviewResult?.reviewAnswer === 'RED') {
          kycStatus         = 'rejected';
          submissionStatus  = 'rejected';
        }
      } else if (event.type === 'applicantPending') {
        kycStatus         = 'pending';
        submissionStatus  = 'pending';
      } else if (event.type === 'applicantOnHold') {
        kycStatus         = 'under_review';
        submissionStatus  = 'under_review';
      }

      if (kycStatus) {
        await client.query(
          'UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2',
          [kycStatus, applicant.user_id],
        );
      }

      if (submissionStatus) {
        await client.query(`
          UPDATE kyc_submissions
          SET status = $1, reviewed_at = NOW(), updated_at = NOW()
          WHERE user_id = $2
            AND status NOT IN ('approved', 'rejected')
          ORDER BY created_at DESC
          LIMIT 1
        `, [submissionStatus, applicant.user_id]);
      }

      // Fire webhook event for downstream systems
      if (kycStatus === 'approved') {
        const { dispatchWebhookEvent } = await import('../webhooks/webhooks.service.js');
        await dispatchWebhookEvent('user.kyc_approved', { userId: applicant.user_id, applicantId: event.applicantId });
      } else if (kycStatus === 'rejected') {
        const { dispatchWebhookEvent } = await import('../webhooks/webhooks.service.js');
        await dispatchWebhookEvent('user.kyc_rejected', {
          userId: applicant.user_id,
          applicantId: event.applicantId,
          reason: event.reviewResult?.moderationComment ?? event.reviewResult?.rejectLabels?.join(', '),
        });
      }
    });
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────
let _instance: SumsubService | null = null;

export function getSumsubService(): SumsubService {
  if (!_instance) {
    const appToken  = process.env.SUMSUB_APP_TOKEN;
    const secretKey = process.env.SUMSUB_SECRET_KEY;
    const levelName = process.env.SUMSUB_LEVEL_NAME ?? 'basic-kyc-level';

    if (!appToken || !secretKey) {
      throw new Error('SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be set in .env');
    }

    _instance = new SumsubService(appToken, secretKey, levelName);
  }
  return _instance;
}

export function clearSumsubCache() { _instance = null; }
