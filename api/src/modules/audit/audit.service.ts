import { query } from '../../db/index.js';

// admin_audit_log real cols: id, admin_id, action, entity_type, entity_id, old_data, new_data, ip_address, created_at
export interface AuditEntry {
  adminId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log
       (admin_id, action, entity_type, entity_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      entry.adminId ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.oldData ? JSON.stringify(entry.oldData) : null,
      entry.newData ? JSON.stringify(entry.newData) : null,
      entry.ipAddress ?? null,
    ],
  );
}

export async function listAuditLogs(params: {
  page: number; limit: number;
  action?: string; adminId?: string;
  entityType?: string; entityId?: string;
  from?: string; to?: string;
}) {
  const { page, limit, action, adminId, entityType, entityId, from, to } = params;
  const offset = (page - 1) * limit;
  const conds: string[] = ['1=1'];
  const vals: unknown[] = [];
  let i = 1;

  if (action)     { conds.push(`al.action = $${i++}`);          vals.push(action); }
  if (adminId)    { conds.push(`al.admin_id = $${i++}`);        vals.push(adminId); }
  if (entityType) { conds.push(`al.entity_type = $${i++}`);     vals.push(entityType); }
  if (entityId)   { conds.push(`al.entity_id::text = $${i++}`); vals.push(entityId); }
  if (from)       { conds.push(`al.created_at >= $${i++}`);     vals.push(from); }
  if (to)         { conds.push(`al.created_at <= $${i++}`);     vals.push(to); }

  const where = conds.join(' AND ');

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM admin_audit_log al WHERE ${where}`, vals,
  );
  const total = parseInt(countRow?.count ?? '0', 10);

  const logs = await query(`
    SELECT al.*,
      au.first_name || ' ' || au.last_name AS admin_name,
      au.email AS admin_email
    FROM admin_audit_log al
    LEFT JOIN admin_users au ON au.id = al.admin_id
    WHERE ${where}
    ORDER BY al.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `, [...vals, limit, offset]);

  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAuditStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)                    AS total_today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')       AS total_week,
      COUNT(DISTINCT admin_id) FILTER (WHERE created_at >= CURRENT_DATE)    AS admins_active_today,
      COUNT(*) FILTER (WHERE (action LIKE '%.approve%' OR action LIKE '%.reject%')
        AND created_at >= CURRENT_DATE)                                      AS approvals_today
    FROM admin_audit_log
  `);
  return stats;
}

export async function getAuditActions(): Promise<string[]> {
  const rows = await query<{ action: string }>(
    `SELECT DISTINCT action FROM admin_audit_log ORDER BY action`,
  );
  return rows.map(r => r.action);
}
