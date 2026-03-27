import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getPermissionsMatrix, getRolePermissions,
  updateRolePermissions, grantPermission, revokePermission,
} from './permissions.service.js';

export async function permissionsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  // Full matrix for UI
  app.get('/matrix', async (_req, reply) =>
    reply.send(await getPermissionsMatrix()),
  );

  // Get permissions for a specific role
  app.get('/:role', async (req, reply) => {
    const { role } = req.params as { role: string };
    return reply.send(await getRolePermissions(role));
  });

  // Bulk update all permissions for a role
  app.put('/:role', async (req, reply) => {
    const { role } = req.params as { role: string };
    const { permissions } = z.object({
      permissions: z.array(z.string()),
    }).parse(req.body);
    await updateRolePermissions(role, permissions, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  // Grant single permission
  app.post('/:role/:key', async (req, reply) => {
    const { role, key } = req.params as { role: string; key: string };
    await grantPermission(role, key, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  // Revoke single permission
  app.delete('/:role/:key', async (req, reply) => {
    const { role, key } = req.params as { role: string; key: string };
    await revokePermission(role, key);
    return reply.send({ ok: true });
  });
}
