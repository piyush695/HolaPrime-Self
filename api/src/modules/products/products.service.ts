import { query, queryOne, withTransaction } from '../../db/index.js';

// ── Challenge Products CRUD ───────────────────────────────────────────────────

export async function listProducts(includeInactive = false) {
  const where = includeInactive ? '' : "WHERE status != 'archived'";
  return query(`
    SELECT cp.*,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.product_id = cp.id) AS total_accounts,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.product_id = cp.id AND ta.status = 'active') AS active_accounts,
      (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.product_id = cp.id AND ta.status = 'funded') AS funded_accounts
    FROM challenge_products cp
    ${where}
    ORDER BY sort_order, account_size
  `);
}

export async function getProduct(id: string) {
  return queryOne('SELECT * FROM challenge_products WHERE id = $1', [id]);
}

export async function createProduct(data: ProductInput, adminId: string): Promise<string> {
  const slug = data.slug ?? data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const [p] = await query<{ id: string }>(`
    INSERT INTO challenge_products (
      name, slug, description, status,
      account_size, fee, currency, platform,
      phases, leverage, instruments_allowed,
      news_trading_allowed, weekend_holding_allowed,
      scaling_plan, profit_split, payout_frequency,
      sort_order, metadata, created_by
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      $9,$10,$11,
      $12,$13,
      $14,$15,$16,
      $17,$18,$19
    )
    RETURNING id
  `, [
    data.name, slug, data.description ?? null,
    data.status ?? 'draft',
    data.accountSize, data.fee, data.currency ?? 'USD',
    data.platform ?? 'mt5',
    JSON.stringify(data.phases ?? []),
    data.leverage ?? '1:100',
    data.instrumentsAllowed ?? ['FOREX','GOLD','INDICES'],
    data.newsTradingAllowed ?? false,
    data.weekendHoldingAllowed ?? false,
    data.scalingPlan ?? false,
    data.profitSplit ?? 80,
    data.payoutFrequency ?? 'monthly',
    data.sortOrder ?? 0,
    JSON.stringify(data.metadata ?? {}),
    adminId,
  ]);
  return p.id;
}

export async function updateProduct(id: string, data: Partial<ProductInput>, adminId: string): Promise<void> {
  const sets: string[]  = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let   n = 1;

  const FIELD_MAP: Record<keyof ProductInput, string> = {
    name:                  'name',
    slug:                  'slug',
    description:           'description',
    shortTagline:          'short_tagline',
    status:                'status',
    accountSize:           'account_size',
    fee:                   'fee',
    currency:              'currency',
    platform:              'platform',
    phases:                'phases',
    leverage:              'leverage',
    instrumentsAllowed:    'instruments_allowed',
    newsTradingAllowed:    'news_trading_allowed',
    weekendHoldingAllowed: 'weekend_holding_allowed',
    scalingPlan:           'scaling_plan',
    profitSplit:           'profit_split',
    payoutFrequency:       'payout_frequency',
    badgeText:             'badge_text',
    badgeColor:            'badge_color',
    icon:                  'icon',
    highlight:             'highlight',
    isFeatured:            'is_featured',
    features:              'features',
    maxAccounts:           'max_accounts',
    refundPolicy:          'refund_policy',
    groupPrefix:           'group_prefix',
    sortOrder:             'sort_order',
    metadata:              'metadata',
  };

  for (const [key, col] of Object.entries(FIELD_MAP)) {
    const val = (data as any)[key];
    if (val === undefined) continue;

    const serialised = ['phases','metadata'].includes(key) ? JSON.stringify(val) : val;
    sets.push(`${col} = $${n++}`);
    vals.push(serialised);
  }

  if (sets.length === 1) return; // nothing to update

  await query(
    `UPDATE challenge_products SET ${sets.join(', ')} WHERE id = $${n}`,
    [...vals, id],
  );

  await query(`
    INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, new_data)
    VALUES ($1, 'product.updated', 'challenge_product', $2, $3)
  `, [adminId, id, JSON.stringify(data)]);
}

export async function archiveProduct(id: string, adminId: string): Promise<void> {
  const accounts = await query<{ count: string }>(
    "SELECT COUNT(*) FROM trading_accounts WHERE product_id = $1 AND status = 'active'", [id],
  );
  if (parseInt((accounts[0] as any).count, 10) > 0) {
    throw new Error('Cannot archive product with active accounts');
  }
  await query("UPDATE challenge_products SET status = 'archived', updated_at = NOW() WHERE id = $1", [id]);
  await query(`
    INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id)
    VALUES ($1, 'product.archived', 'challenge_product', $2)
  `, [adminId, id]);
}

export async function duplicateProduct(id: string, adminId: string): Promise<string> {
  const original = await queryOne<Record<string, unknown>>('SELECT * FROM challenge_products WHERE id = $1', [id]);
  if (!original) throw new Error('Product not found');

  const newName = `${original.name} (Copy)`;
  const newSlug = `${original.slug}-copy-${Date.now()}`;

  const [copy] = await query<{ id: string }>(`
    INSERT INTO challenge_products
      (name, slug, description, status, account_size, fee, currency,
       platform, phases, leverage, instruments_allowed, news_trading_allowed,
       weekend_holding_allowed, scaling_plan, profit_split, payout_frequency,
       sort_order, metadata, created_by)
    SELECT $1,$2,description,'draft',account_size,fee,currency,
       platform,phases,leverage,instruments_allowed,news_trading_allowed,
       weekend_holding_allowed,scaling_plan,profit_split,payout_frequency,
       sort_order+1,metadata,$3
    FROM challenge_products WHERE id = $4
    RETURNING id
  `, [newName, newSlug, adminId, id]);

  return copy.id;
}

// ── Phase & Status Labels ─────────────────────────────────────────────────────

export async function getPhaseLabels() {
  return query('SELECT * FROM account_phase_labels ORDER BY phase_key');
}

export async function updatePhaseLabel(phaseKey: string, data: {
  label?: string; shortLabel?: string; color?: string; description?: string;
}): Promise<void> {
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let n = 1;

  if (data.label       !== undefined) { sets.push(`label = $${n++}`);       vals.push(data.label); }
  if (data.shortLabel  !== undefined) { sets.push(`short_label = $${n++}`); vals.push(data.shortLabel); }
  if (data.color       !== undefined) { sets.push(`color = $${n++}`);       vals.push(data.color); }
  if (data.description !== undefined) { sets.push(`description = $${n++}`); vals.push(data.description); }

  await query(
    `UPDATE account_phase_labels SET ${sets.join(', ')} WHERE phase_key = $${n}`,
    [...vals, phaseKey],
  );
}

export async function getStatusLabels() {
  return query('SELECT * FROM account_status_labels ORDER BY status_key');
}

export async function updateStatusLabel(statusKey: string, data: {
  label?: string; color?: string; description?: string;
}): Promise<void> {
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let n = 1;

  if (data.label       !== undefined) { sets.push(`label = $${n++}`);       vals.push(data.label); }
  if (data.color       !== undefined) { sets.push(`color = $${n++}`);       vals.push(data.color); }
  if (data.description !== undefined) { sets.push(`description = $${n++}`); vals.push(data.description); }

  await query(
    `UPDATE account_status_labels SET ${sets.join(', ')} WHERE status_key = $${n}`,
    [...vals, statusKey],
  );
}

// ── Type ──────────────────────────────────────────────────────────────────────
interface ProductInput {
  name:                  string;
  slug?:                 string;
  description?:          string;
  shortTagline?:         string;
  status?:               string;
  accountSize:           number;
  fee:                   number;
  currency?:             string;
  platform?:             string;
  phases?:               Array<{
    phase: string;
    profit_target:     number;
    max_daily_loss:    number;
    max_total_loss:    number;
    min_trading_days:  number;
    max_duration_days?: number;
  }>;
  leverage?:             string;
  instrumentsAllowed?:   string[];
  newsTradingAllowed?:   boolean;
  weekendHoldingAllowed?: boolean;
  scalingPlan?:          boolean;
  profitSplit?:          number;
  payoutFrequency?:      string;
  badgeText?:            string;
  badgeColor?:           string;
  icon?:                 string;
  highlight?:            boolean;
  isFeatured?:           boolean;
  features?:             string[];
  maxAccounts?:          number;
  refundPolicy?:         string;
  groupPrefix?:          string;
  sortOrder?:            number;
  metadata?:             Record<string, unknown>;
}
