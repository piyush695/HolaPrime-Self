import { query, queryOne, withTransaction } from '../../db/index.js';
import { Storage } from '@google-cloud/storage';
import { config } from '../../config/index.js';

const storage = new Storage({ projectId: config.gcp.projectId });
const bucket  = storage.bucket(config.gcp.bucket);

export async function getKycQueue(status = 'pending', page = 1, limit = 25) {
  const offset = (page - 1) * limit;
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM kyc_submissions WHERE status = $1`, [status],
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const submissions = await query(`
    SELECT
      ks.id, ks.status, ks.created_at, ks.updated_at,
      u.id AS user_id, u.email, u.first_name, u.last_name, u.country_code,
      (SELECT COUNT(*) FROM kyc_documents kd WHERE kd.submission_id = ks.id) AS doc_count
    FROM kyc_submissions ks
    JOIN users u ON u.id = ks.user_id
    WHERE ks.status = $1
    ORDER BY ks.created_at ASC
    LIMIT $2 OFFSET $3
  `, [status, limit, offset]);

  return { submissions, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getKycSubmission(submissionId: string) {
  const submission = await queryOne(`
    SELECT ks.*, u.email, u.first_name, u.last_name, u.country_code, u.date_of_birth,
           a.first_name AS reviewer_first, a.last_name AS reviewer_last
    FROM kyc_submissions ks
    JOIN users u ON u.id = ks.user_id
    LEFT JOIN admin_users a ON a.id = ks.reviewer_id
    WHERE ks.id = $1
  `, [submissionId]);

  if (!submission) return null;

  const documents = await query(
    `SELECT id, doc_type, file_name, file_size, mime_type, is_verified, rejection_note, created_at
     FROM kyc_documents WHERE submission_id = $1`,
    [submissionId],
  );

  return { ...submission, documents };
}

export async function approveKyc(
  submissionId: string,
  reviewerId: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const sub = await client.query(
      'SELECT user_id FROM kyc_submissions WHERE id = $1', [submissionId],
    );
    if (!sub.rows[0]) throw new Error('Submission not found');

    await client.query(`
      UPDATE kyc_submissions
      SET status = 'approved', reviewer_id = $1, reviewed_at = NOW(),
          expires_at = NOW() + INTERVAL '2 years', updated_at = NOW()
      WHERE id = $2
    `, [reviewerId, submissionId]);

    await client.query(`
      UPDATE users SET kyc_status = 'approved', status = 'active', updated_at = NOW()
      WHERE id = $1
    `, [sub.rows[0].user_id]);

    await client.query(`
      INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id)
      VALUES ($1, 'kyc.approved', 'kyc_submission', $2)
    `, [reviewerId, submissionId]);
  });
}

export async function rejectKyc(
  submissionId: string,
  reviewerId: string,
  reason: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const sub = await client.query(
      'SELECT user_id FROM kyc_submissions WHERE id = $1', [submissionId],
    );
    if (!sub.rows[0]) throw new Error('Submission not found');

    await client.query(`
      UPDATE kyc_submissions
      SET status = 'rejected', reviewer_id = $1, reviewed_at = NOW(),
          rejection_reason = $2, updated_at = NOW()
      WHERE id = $3
    `, [reviewerId, reason, submissionId]);

    await client.query(`
      UPDATE users SET kyc_status = 'rejected', updated_at = NOW() WHERE id = $1
    `, [sub.rows[0].user_id]);

    await client.query(`
      INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, new_data)
      VALUES ($1, 'kyc.rejected', 'kyc_submission', $2, $3)
    `, [reviewerId, submissionId, JSON.stringify({ reason })]);
  });
}

export async function generateDocumentSignedUrl(
  submissionId: string,
  documentId: string,
): Promise<string> {
  const doc = await queryOne<{ gcs_path: string; mime_type: string }>(
    'SELECT gcs_path, mime_type FROM kyc_documents WHERE id = $1 AND submission_id = $2',
    [documentId, submissionId],
  );
  if (!doc) throw new Error('Document not found');

  const file = bucket.file(doc.gcs_path);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action:  'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 min
    responseType: doc.mime_type,
  });
  return url;
}

export async function getKycStats() {
  const [stats] = await query<{
    total: string; pending: string; under_review: string;
    approved: string; rejected: string;
  }>(`
    SELECT
      COUNT(*)                                                       AS total,
      COUNT(*) FILTER (WHERE status = 'pending')                    AS pending,
      COUNT(*) FILTER (WHERE status = 'under_review')               AS under_review,
      COUNT(*) FILTER (WHERE status = 'approved')                   AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected')                   AS rejected
    FROM kyc_submissions
  `);
  return stats;
}

// ── S2S event hooks (added for EventBus integration) ─────────────────────────
export async function fireKycApprovedEvent(userId: string, email: string, firstName: string, lastName: string, countryCode: string) {
  const { fireEvent } = await import('../integrations/event-bus.js');
  await fireEvent('user.kyc_approved', { userId, email, firstName, lastName, countryCode }).catch(console.error);
}

export async function fireKycRejectedEvent(userId: string, email: string) {
  const { fireEvent } = await import('../integrations/event-bus.js');
  await fireEvent('user.kyc_rejected', { userId, email }).catch(console.error);
}
