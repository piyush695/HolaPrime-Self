import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

// ── Platform cohort definitions ───────────────────────────────────────────────
const COHORT_QUERIES: Record<string, { label: string; description: string; sql: string; params?: any[] }> = {
  inactive_7d: {
    label: 'Inactive 7+ Days',
    description: 'Traders with active accounts who have not traded in 7+ days',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone as phone
          FROM users u
          JOIN trading_accounts ta ON ta.user_id = u.id
          WHERE ta.status = 'active'
            AND (ta.last_sync_at IS NULL OR ta.last_sync_at < NOW() - INTERVAL '7 days')
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  inactive_30d: {
    label: 'Inactive 30+ Days',
    description: 'Traders who have not logged in or traded in 30+ days',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone
          FROM users u
          LEFT JOIN trading_accounts ta ON ta.user_id = u.id
          WHERE (u.last_login_at IS NULL OR u.last_login_at < NOW() - INTERVAL '30 days')
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  breached_30d: {
    label: 'Breached Last 30 Days',
    description: 'Traders whose accounts were breached in the last 30 days — prime for win-back',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone,
                 ta.platform, ta.account_size, ta.breach_type, ta.breached_at
          FROM users u
          JOIN trading_accounts ta ON ta.user_id = u.id
          WHERE ta.breached_at > NOW() - INTERVAL '30 days'
            AND ta.status = 'breached'
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  breached_90d: {
    label: 'Breached Last 90 Days',
    description: 'All traders who breached in the last 90 days — broader win-back pool',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone,
                 ta.account_size, ta.breached_at
          FROM users u
          JOIN trading_accounts ta ON ta.user_id = u.id
          WHERE ta.breached_at > NOW() - INTERVAL '90 days'
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  funded_no_payout: {
    label: 'Funded — No Payout Yet',
    description: 'Funded traders who have never requested a payout — engage and encourage first withdrawal',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone
          FROM users u
          JOIN trading_accounts ta ON ta.user_id = u.id AND ta.status = 'funded'
          WHERE NOT EXISTS (
            SELECT 1 FROM payout_requests pr WHERE pr.user_id = u.id
          )
          AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  kyc_pending: {
    label: 'KYC Pending',
    description: 'Traders who have passed challenge but not completed KYC',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone
          FROM users u
          JOIN trading_accounts ta ON ta.user_id = u.id
          WHERE ta.status = 'passed'
            AND u.kyc_status IN ('not_started', 'pending')
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  never_purchased: {
    label: 'Registered — Never Purchased',
    description: 'Traders who registered but never bought a challenge',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone,
                 u.created_at as registered_at
          FROM users u
          WHERE NOT EXISTS (
            SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.type = 'challenge_fee' AND p.status = 'completed'
          )
            AND u.created_at > NOW() - INTERVAL '180 days'
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  high_value: {
    label: 'High Value Traders ($100K+)',
    description: 'Traders with $100K+ funded accounts — top tier for premium offers',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone,
                 ta.account_size, ta.platform
          FROM users u
          JOIN trading_accounts ta ON ta.user_id = u.id
          WHERE ta.account_size >= 100000
            AND ta.status = 'funded'
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  payout_approved_last_30d: {
    label: 'Recently Paid Out (30 days)',
    description: 'Traders who received a payout in the last 30 days — high engagement, upsell opportunity',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone
          FROM users u
          JOIN payout_requests pr ON pr.user_id = u.id
          WHERE pr.status = 'paid'
            AND pr.paid_at > NOW() - INTERVAL '30 days'
            AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
  multi_account: {
    label: 'Multi-Account Traders (2+)',
    description: 'Traders who have purchased 2+ challenges — loyal, high LTV',
    sql: `SELECT DISTINCT u.id as user_id, u.email, u.first_name, u.last_name, u.phone
          FROM users u
          WHERE (
            SELECT COUNT(*) FROM trading_accounts ta WHERE ta.user_id = u.id
          ) >= 2
          AND u.email NOT IN (SELECT email FROM email_unsubscribes WHERE list_type='all')`,
  },
};

export async function audiencesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  // ── GET all audiences ─────────────────────────────────────────────────────
  app.get('/', async (_req, reply) => {
    const rows = await query(`
      SELECT id, name, description, type, cohort_key, contact_count, status,
             last_refreshed_at, created_at
      FROM audiences ORDER BY created_at DESC
    `);
    return reply.send(rows);
  });

  // ── GET cohort definitions ────────────────────────────────────────────────
  app.get('/cohorts', async (_req, reply) => {
    const cohorts = Object.entries(COHORT_QUERIES).map(([key, def]) => ({
      key,
      label: def.label,
      description: def.description,
    }));
    return reply.send(cohorts);
  });

  // ── GET cohort preview count ──────────────────────────────────────────────
  app.get('/cohorts/:key/count', async (req, reply) => {
    const { key } = req.params as { key: string };
    const cohort = COHORT_QUERIES[key];
    if (!cohort) return reply.status(404).send({ error: 'Cohort not found' });
    try {
      const rows = await query(`SELECT COUNT(*) as n FROM (${cohort.sql}) sub`);
      return reply.send({ count: parseInt((rows[0] as any).n) });
    } catch(e) {
      return reply.send({ count: 0, error: String(e) });
    }
  });

  // ── GET audience contacts ─────────────────────────────────────────────────
  app.get('/:id/contacts', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { limit = '50', offset = '0' } = req.query as Record<string, string>;
    const rows = await query(`
      SELECT email, first_name, last_name, phone, merge_data, opted_out, created_at
      FROM audience_contacts
      WHERE audience_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);
    const total = await queryOne<{ n: string }>(
      'SELECT COUNT(*) as n FROM audience_contacts WHERE audience_id=$1', [id]
    );
    return reply.send({ contacts: rows, total: parseInt(total?.n ?? '0') });
  });

  // ── POST create from platform cohort ─────────────────────────────────────
  app.post('/cohort', async (req, reply) => {
    const { cohortKey, name } = req.body as { cohortKey: string; name?: string };
    const admin = (req as any).admin;
    const cohort = COHORT_QUERIES[cohortKey];
    if (!cohort) return reply.status(400).send({ error: 'Invalid cohort key' });

    // Create the audience record
    const [aud] = await query<{ id: string }>(`
      INSERT INTO audiences (name, description, type, cohort_key, status, created_by)
      VALUES ($1, $2, 'platform_cohort', $3, 'building', $4)
      RETURNING id
    `, [name ?? cohort.label, cohort.description, cohortKey, admin.id]);

    // Build contacts async
    buildCohortAudience(aud.id, cohort.sql).catch(console.error);

    return reply.status(201).send({ id: aud.id, status: 'building' });
  });

  // ── POST create from CSV upload ───────────────────────────────────────────
  app.post('/upload', async (req, reply) => {
    const { name, contacts, sourceFile } = req.body as {
      name: string;
      contacts: Array<{ email?: string; phone?: string; first_name?: string; last_name?: string; [key: string]: string | undefined }>;
      sourceFile?: string;
    };
    const admin = (req as any).admin;

    if (!name) return reply.status(400).send({ error: 'Audience name required' });
    if (!contacts?.length) return reply.status(400).send({ error: 'No contacts provided' });

    // Validate — need at least email or phone per contact
    const valid = contacts.filter(c => c.email || c.phone);
    if (!valid.length) return reply.status(400).send({ error: 'Each contact needs at least an email or phone' });

    // Create audience
    const [aud] = await query<{ id: string }>(`
      INSERT INTO audiences (name, type, source_file, contact_count, status, created_by, last_refreshed_at)
      VALUES ($1, 'custom_upload', $2, $3, 'ready', $4, NOW())
      RETURNING id
    `, [name, sourceFile ?? null, valid.length, admin.id]);

    // Bulk insert contacts
    for (const c of valid) {
      const { email, phone, first_name, last_name, ...rest } = c;
      await query(`
        INSERT INTO audience_contacts (audience_id, email, phone, first_name, last_name, merge_data)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [aud.id, email?.toLowerCase() ?? null, phone ?? null,
          first_name ?? null, last_name ?? null, JSON.stringify(rest)]);
    }

    return reply.status(201).send({ id: aud.id, count: valid.length });
  });

  // ── POST refresh a cohort audience ───────────────────────────────────────
  app.post('/:id/refresh', async (req, reply) => {
    const { id } = req.params as { id: string };
    const aud = await queryOne<{ cohort_key: string; type: string }>(
      'SELECT cohort_key, type FROM audiences WHERE id=$1', [id]
    );
    if (!aud) return reply.status(404).send({ error: 'Not found' });
    if (aud.type !== 'platform_cohort') return reply.status(400).send({ error: 'Only cohort audiences can be refreshed' });
    const cohort = COHORT_QUERIES[aud.cohort_key];
    if (!cohort) return reply.status(400).send({ error: 'Cohort definition not found' });

    await query("UPDATE audiences SET status='building' WHERE id=$1", [id]);
    buildCohortAudience(id, cohort.sql).catch(console.error);
    return reply.send({ ok: true, status: 'building' });
  });

  // ── DELETE audience ────────────────────────────────────────────────────────
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('DELETE FROM audiences WHERE id=$1', [id]);
    return reply.send({ ok: true });
  });

  // ── GET campaigns using this audience ────────────────────────────────────
  app.get('/:id/campaigns', async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await query(`
      SELECT c.id, c.name, c.type, c.status, c.sent_count, c.created_at
      FROM campaigns c
      JOIN campaign_audiences ca ON ca.campaign_id = c.id
      WHERE ca.audience_id = $1
      ORDER BY c.created_at DESC
    `, [id]);
    return reply.send(rows);
  });

  // ── Attach audience to campaign ───────────────────────────────────────────
  app.post('/attach', async (req, reply) => {
    const { campaignId, audienceId } = req.body as { campaignId: string; audienceId: string };
    await query(`
      INSERT INTO campaign_audiences (campaign_id, audience_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [campaignId, audienceId]);
    // Update campaign audience_count
    await query(`
      UPDATE campaigns SET audience_count = (
        SELECT COALESCE(SUM(a.contact_count), 0)
        FROM campaign_audiences ca JOIN audiences a ON a.id = ca.audience_id
        WHERE ca.campaign_id = $1
      ) WHERE id = $1
    `, [campaignId]);
    return reply.send({ ok: true });
  });

  // ── Detach audience from campaign ─────────────────────────────────────────
  app.delete('/attach/:campaignId/:audienceId', async (req, reply) => {
    const { campaignId, audienceId } = req.params as Record<string, string>;
    await query('DELETE FROM campaign_audiences WHERE campaign_id=$1 AND audience_id=$2', [campaignId, audienceId]);
    return reply.send({ ok: true });
  });

  // ── GET audiences attached to a campaign ──────────────────────────────────
  app.get('/by-campaign/:campaignId', async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const rows = await query(`
      SELECT a.id, a.name, a.description, a.type, a.cohort_key, a.contact_count,
             a.status, a.last_refreshed_at
      FROM audiences a
      JOIN campaign_audiences ca ON ca.audience_id = a.id
      WHERE ca.campaign_id = $1
    `, [campaignId]);
    return reply.send(rows);
  });
}

// ── Async cohort builder ──────────────────────────────────────────────────────
async function buildCohortAudience(audienceId: string, sql: string): Promise<void> {
  try {
    // Clear existing contacts
    await query('DELETE FROM audience_contacts WHERE audience_id=$1', [audienceId]);
    // Run cohort query
    const contacts = await query(sql);
    // Insert results
    for (const c of contacts as any[]) {
      await query(`
        INSERT INTO audience_contacts
          (audience_id, email, phone, first_name, last_name, user_id, merge_data)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [audienceId, c.email ?? null, c.phone ?? null,
          c.first_name ?? null, c.last_name ?? null,
          c.user_id ?? null,
          JSON.stringify(Object.fromEntries(
            Object.entries(c).filter(([k]) => !['user_id','email','phone','first_name','last_name'].includes(k))
          ))]);
    }
    // Update count + status
    await query(`
      UPDATE audiences SET
        contact_count = $1, status = 'ready', last_refreshed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [contacts.length, audienceId]);
  } catch(err) {
    await query(
      "UPDATE audiences SET status='error', error_msg=$1, updated_at=NOW() WHERE id=$2",
      [String(err), audienceId]
    );
  }
}
