import { query, queryOne, withTransaction } from '../../db/index.js';

export async function getAllPermissions() {
  return query(`
    SELECT p.*,
      CASE WHEN rp.role IS NOT NULL THEN true ELSE false END AS granted
    FROM permissions p
    ORDER BY p.module, p.key
  `);
}

export async function getPermissionsMatrix() {
  const permissions = await query<{
    key: string; module: string; label: string;
    description: string; is_destructive: boolean;
  }>(`SELECT * FROM permissions ORDER BY module, key`);

  const assignments = await query<{ role: string; permission_key: string }>(
    `SELECT role, permission_key FROM role_permissions`,
  );

  const roles = ['super_admin', 'admin', 'support'];
  const matrix: Record<string, Record<string, boolean>> = {};

  for (const role of roles) {
    matrix[role] = {};
    for (const perm of permissions) {
      matrix[role][perm.key] = assignments.some(
        a => a.role === role && a.permission_key === perm.key,
      );
    }
  }

  // Group permissions by module
  const modules: Record<string, typeof permissions> = {};
  for (const perm of permissions) {
    if (!modules[perm.module]) modules[perm.module] = [];
    modules[perm.module].push(perm);
  }

  return { permissions, modules, matrix, roles };
}

export async function getRolePermissions(role: string): Promise<string[]> {
  const rows = await query<{ permission_key: string }>(
    `SELECT permission_key FROM role_permissions WHERE role = $1`, [role],
  );
  return rows.map(r => r.permission_key);
}

export async function updateRolePermissions(
  role: string,
  permissionKeys: string[],
  grantedBy: string,
): Promise<void> {
  await withTransaction(async (client) => {
    // Remove all existing for this role
    await client.query(`DELETE FROM role_permissions WHERE role = $1`, [role]);

    // Re-insert granted ones
    if (permissionKeys.length > 0) {
      const values = permissionKeys
        .map((_, i) => `($1, $${i + 2}, $${permissionKeys.length + 2})`)
        .join(', ');
      await client.query(
        `INSERT INTO role_permissions (role, permission_key, granted_by) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [role, ...permissionKeys, grantedBy],
      );
    }
  });
}

export async function grantPermission(
  role: string, permissionKey: string, grantedBy: string,
): Promise<void> {
  await query(
    `INSERT INTO role_permissions (role, permission_key, granted_by)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [role, permissionKey, grantedBy],
  );
}

export async function revokePermission(role: string, permissionKey: string): Promise<void> {
  await query(
    `DELETE FROM role_permissions WHERE role = $1 AND permission_key = $2`,
    [role, permissionKey],
  );
}
