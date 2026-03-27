import { query, queryOne, withTransaction } from '../../db/index.js';

// ── Affiliate management ──────────────────────────────────────────────────────
export async function listAffiliates(params: {
  page: number; limit: number; status?: string; search?: string;
}) {
  const { page, limit, status, search } = params;
  const offset = (page - 1) * limit;
  const conds: string[] = ['1=1'];
  const vals: unknown[] = [];
  let i = 1;

  if (status) { conds.push(`a.status = $${i++}`); vals.push(status); }
  if (search) { conds.push(`(a.email ILIKE $${i} OR a.first_name ILIKE $${i} OR a.last_name ILIKE $${i} OR a.code ILIKE $${i})`); vals.push(`%${search}%`); i++; }

  const where = conds.join(' AND ');
  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM affiliates a WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const affiliates = await query(`
    SELECT a.*,
      (SELECT COUNT(*) FROM affiliate_clicks ac WHERE ac.affiliate_id = a.id) AS total_clicks,
      (SELECT COUNT(*) FROM affiliate_conversions ac WHERE ac.affiliate_id = a.id) AS total_conversions_count,
      COALESCE(a.total_earned - a.total_paid, 0) AS pending_balance
    FROM affiliates a
    WHERE ${where}
    ORDER BY a.total_earned DESC
    LIMIT $${i} OFFSET $${i+1}
  `, [...vals, limit, offset]);

  return { affiliates, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAffiliate(id: string) {
  const affiliate = await queryOne(`
    SELECT a.*,
      COALESCE(a.total_earned - a.total_paid, 0) AS pending_balance
    FROM affiliates a WHERE a.id = $1
  `, [id]);

  if (!affiliate) return null;

  const links = await query(
    'SELECT * FROM affiliate_links WHERE affiliate_id = $1 ORDER BY created_at DESC', [id],
  );

  const recentConversions = await query(`
    SELECT ac.*, u.email, u.first_name, u.last_name,
           p.amount AS payment_amount, p.type AS payment_type
    FROM affiliate_conversions ac
    JOIN users u ON u.id = ac.user_id
    LEFT JOIN payments p ON p.id = ac.payment_id
    WHERE ac.affiliate_id = $1
    ORDER BY ac.created_at DESC LIMIT 20
  `, [id]);

  const clickTrend = await query(`
    SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
           COUNT(*) AS clicks
    FROM affiliate_clicks
    WHERE affiliate_id = $1
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1
  `, [id]);

  return { ...affiliate, links, recentConversions, clickTrend };
}

export async function createAffiliate(data: {
  email: string; firstName: string; lastName: string;
  company?: string; commissionType?: string; commissionValue?: number;
  adminId: string;
}): Promise<string> {
  const [aff] = await query<{ id: string }>(`
    INSERT INTO affiliates (email, first_name, last_name, company,
      commission_type, commission_value, status, approved_by, approved_at)
    VALUES ($1,$2,$3,$4,$5,$6,'active',$7,NOW())
    RETURNING id
  `, [
    data.email, data.firstName, data.lastName, data.company,
    data.commissionType ?? 'percentage',
    data.commissionValue ?? 20,
    data.adminId,
  ]);
  return aff.id;
}

export async function createAffiliateLink(params: {
  affiliateId: string; name: string; destinationUrl: string;
  utmCampaign?: string;
}): Promise<{ id: string; slug: string; fullUrl: string }> {
  const slug = `${params.affiliateId.slice(0,8)}-${Date.now().toString(36)}`;

  const [link] = await query<{ id: string; slug: string }>(`
    INSERT INTO affiliate_links (affiliate_id, name, slug, destination_url, utm_campaign)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id, slug
  `, [params.affiliateId, params.name, slug, params.destinationUrl, params.utmCampaign]);

  const baseUrl = process.env.FRONTEND_URL ?? 'https://app.holaprime.com';
  return { id: link.id, slug: link.slug, fullUrl: `${baseUrl}/ref/${link.slug}` };
}

// ── Click tracking (called when affiliate link is visited) ────────────────────
export async function trackAffiliateClick(slug: string, ip: string, userAgent: string, landingPage: string, referrer: string): Promise<string | null> {
  const link = await queryOne<{ id: string; affiliate_id: string; destination_url: string; is_active: boolean }>(
    'SELECT * FROM affiliate_links WHERE slug = $1', [slug],
  );

  if (!link || !link.is_active) return null;

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO affiliate_clicks (affiliate_id, ip_address, user_agent, landing_page, referrer)
       VALUES ($1,$2,$3,$4,$5)`,
      [link.affiliate_id, ip, userAgent, landingPage, referrer],
    );
    await client.query(
      `UPDATE affiliate_links SET clicks = clicks + 1 WHERE id = $1`,
      [link.id],
    );
  });

  return link.destination_url;
}

// ── Commission calculation ────────────────────────────────────────────────────
export async function calculateAndRecordCommission(params: {
  affiliateId: string; userId: string; paymentId?: string;
  event: string; revenue: number;
}): Promise<number> {
  // Look for affiliate-specific rule first, then global default
  const rule = await queryOne<{
    type: string; value: number; min_deposit: number | null; max_per_referral: number | null;
  }>(`
    SELECT * FROM affiliate_commission_rules
    WHERE (affiliate_id = $1 OR affiliate_id IS NULL)
      AND event = $2 AND is_active = true
    ORDER BY affiliate_id NULLS LAST
    LIMIT 1
  `, [params.affiliateId, params.event]);

  let commission = 0;
  if (rule) {
    commission = rule.type === 'flat'
      ? rule.value
      : (params.revenue * rule.value) / 100;

    if (rule.max_per_referral) commission = Math.min(commission, rule.max_per_referral);
  } else {
    // Default: 20% of revenue
    commission = params.revenue * 0.20;
  }

  await withTransaction(async (client) => {
    await client.query(`
      INSERT INTO affiliate_conversions (affiliate_id, user_id, payment_id, commission)
      VALUES ($1,$2,$3,$4)
    `, [params.affiliateId, params.userId, params.paymentId, commission]);

    await client.query(`
      UPDATE affiliate_links
      SET conversions = conversions + 1
      WHERE affiliate_id = $1
      LIMIT 1
    `, [params.affiliateId]);

    await client.query(`
      UPDATE affiliates
      SET total_referrals = total_referrals + 1,
          total_earned    = total_earned + $1,
          updated_at      = NOW()
      WHERE id = $2
    `, [commission, params.affiliateId]);
  });

  return commission;
}

export async function getAffiliateStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*)                                                  AS total_affiliates,
      COUNT(*) FILTER (WHERE status = 'active')                AS active,
      COUNT(*) FILTER (WHERE status = 'pending')               AS pending,
      COALESCE(SUM(total_referrals),0)                         AS total_referrals,
      COALESCE(SUM(total_earned),0)                            AS total_commissions,
      COALESCE(SUM(total_paid),0)                              AS total_paid,
      COALESCE(SUM(total_earned - total_paid),0)               AS pending_balance
    FROM affiliates
  `);

  const topAffiliates = await query(`
    SELECT id, first_name, last_name, email, code,
           total_referrals, total_earned, total_paid,
           (total_earned - total_paid) AS pending_balance
    FROM affiliates WHERE status = 'active'
    ORDER BY total_earned DESC LIMIT 10
  `);

  return { stats, topAffiliates };
}
